/**
 * semanticKey.js
 * Generates semantic keys for cache lookup.
 */

const crypto = require('crypto');

function generateSemanticKey(normalizedField, entity, attribute) {
  // We hash: namespace + entity + attribute + fieldType + contextTerms
  
  const contextTermsSorted = [...(normalizedField.contextTerms || [])].sort().join(',');
  const rawKey = `semantic:v1|e:${entity}|a:${attribute}|t:${normalizedField.fieldType}|c:${contextTermsSorted}`;
  
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  return {
    rawKey,
    hash
  };
}

function generateFormFingerprint(field) {
  // Hash based on safe form metadata, no profile values
  const components = [
    field.name || '',
    field.id || '',
    field.type || '',
    field.tag || '',
    field.label || '',
    field.section || ''
  ].map(s => s.toString().toLowerCase().trim());
  
  const raw = components.join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

module.exports = {
  generateSemanticKey,
  generateFormFingerprint
};
