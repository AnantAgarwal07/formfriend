/**
 * intelligence.service.js
 * The core intelligence pipeline.
 */

const { normalizeField } = require('./fieldNormalizer');
const { classify } = require('./deterministicClassifier');
const { generateSemanticKey, generateFormFingerprint } = require('./semanticKey');
const { getFromHotCache, setHotCache, getExactMapping, saveMapping, updateMappingFeedback, incrementMetric } = require('./semanticCache.service');
const { checkConstraints } = require('./constraintChecker');
const { resolveAmbiguousField } = require('./llm.service');
const crypto = require('crypto');

async function resolveField(field, formFingerprintObj) {
  // 1. Normalize field
  const normalized = normalizeField(field);

  // 2. Run deterministic classifier
  const deterministicResult = classify(normalized);

  if (deterministicResult.status === 'resolved' && deterministicResult.confidence >= 0.90) {
    await incrementMetric('deterministicResolved');
    
    // Optionally we can save to cache as a system-validated mapping
    // But we just return it immediately
    return deterministicResult;
  }

  // 4. Build semanticKey
  const { rawKey, hash } = generateSemanticKey(normalized, deterministicResult.entity, deterministicResult.attribute);

  // 5. Check Redis semantic hot cache
  const hotCached = await getFromHotCache(hash);
  if (hotCached) {
    if (checkConstraints(hotCached, deterministicResult.entity, deterministicResult.attribute, normalized)) {
      await incrementMetric('semanticCacheHits');
      return {
        status: 'resolved',
        profileField: hotCached.profileField,
        entity: hotCached.entity,
        attribute: hotCached.attribute,
        confidence: hotCached.confidence,
        method: 'semantic-cache',
        cache: { layer: 'L2', hit: true },
        mappingId: hotCached.mappingId,
        reasons: ['redis semantic hot cache match', 'constraints passed']
      };
    }
  }

  // 6. Check DynamoDB exact semantic key
  const dbMapping = await getExactMapping(hash);
  if (dbMapping) {
    if (checkConstraints(dbMapping, deterministicResult.entity, deterministicResult.attribute, normalized)) {
      await incrementMetric('semanticCacheHits');
      // Set hot cache
      await setHotCache(hash, dbMapping);
      
      return {
        status: 'resolved',
        profileField: dbMapping.profileField,
        entity: dbMapping.entity,
        attribute: dbMapping.attribute,
        confidence: dbMapping.confidence,
        method: 'semantic-cache',
        cache: { layer: 'L2', hit: true },
        mappingId: dbMapping.mappingId,
        reasons: ['dynamodb semantic cache match', 'constraints passed']
      };
    }
  }

  await incrementMetric('semanticCacheMisses');

  // 7. Vector search (Not natively possible in generic DDB without OpenSearch, skipping or doing fallback)
  // We'll fall back to structured retrieval logic or LLM.

  // 10. Optional LLM adapter
  const llmResult = await resolveAmbiguousField(normalized, deterministicResult.candidates);

  if (llmResult.status === 'resolved') {
    if (checkConstraints(llmResult, deterministicResult.entity, deterministicResult.attribute, normalized)) {
      await incrementMetric('llmFallbacks');

      const mapping = {
        mappingId: crypto.randomUUID(),
        semanticKey: hash,
        profileField: llmResult.profileField,
        entity: llmResult.entity || 'self',
        attribute: llmResult.attribute || 'ambiguous',
        confidence: llmResult.confidence,
        method: 'llm-fallback',
        validatedCount: 0,
        validationState: 'pending',
        createdAt: new Date().toISOString()
      };

      // AUTO-LEARNING: If LLM is highly confident, cache it instantly!
      if (llmResult.confidence >= 0.85) {
        await setHotCache(hash, mapping);
        await saveMapping(mapping);
      }

      return {
        status: 'resolved',
        profileField: mapping.profileField,
        entity: mapping.entity,
        attribute: mapping.attribute,
        confidence: mapping.confidence,
        method: 'llm-fallback',
        mappingId: mapping.mappingId,
        cache: { layer: 'none', hit: false },
        reasons: ['llm resolution', llmResult.confidence >= 0.85 ? 'auto-cached' : 'pending validation']
      };
    }
  }

  // 11. Otherwise return unresolved/ambiguous
  await incrementMetric('ambiguous');
  return {
    status: 'ambiguous',
    candidates: deterministicResult.candidates,
    confidence: deterministicResult.confidence,
    method: 'semantic-cache' // or deterministic
  };
}

async function processFeedback(mappingId, accepted, correctProfileField) {
  // Validate correctProfileField against Canonical Registry if accepted
  const { CANONICAL_REGISTRY } = require('./deterministicClassifier');
  
  if (accepted && !CANONICAL_REGISTRY.has(correctProfileField)) {
    throw new Error('Invalid correctProfileField. Must be a canonical profile field.');
  }

  const updated = await updateMappingFeedback(mappingId, accepted, correctProfileField);
  
  if (updated) {
    if (accepted) {
      await incrementMetric('validationsAccepted');
      // refresh redis cache with updated item
      await setHotCache(updated.semanticKey, updated);
    } else {
      await incrementMetric('validationsRejected');
    }
  }

  return updated;
}

module.exports = {
  resolveField,
  processFeedback
};
