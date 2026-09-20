/**
 * semanticCache.service.js
 * Handles saving and retrieving semantic mappings from Redis and DynamoDB.
 */

const { getClient: getRedisClient } = require('../services/redis.service');
const { docClient } = require('../services/dynamodb.service');
const { QueryCommand, PutCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

const tableName = process.env.SEMANTIC_CACHE_TABLE_NAME || 'FormSemanticCache';

// We use the same redis client from redis.service, but need access to standard commands.
// Actually, redis.service.js abstracts `setCachedProfile` and `getCachedProfile`.
// Let's create our own redis accessor here.

const { Redis } = require('@upstash/redis');

let _redis = null;
function getRedis() {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}

const REDIS_TTL = parseInt(process.env.SEMANTIC_CACHE_TTL_SECONDS || '86400', 10);

// IN-MEMORY MOCK FOR LOCAL TESTING WITHOUT AWS
const localMockCache = new Map();

async function getFromHotCache(semanticKeyHash) {
  try {
    const redis = getRedis();
    const redisKey = `semantic:exact:${semanticKeyHash}`;
    const result = await redis.get(redisKey);
    return result || localMockCache.get(semanticKeyHash) || null;
  } catch (error) {
    console.error('Redis hot cache get error:', error);
    return localMockCache.get(semanticKeyHash) || null;
  }
}

async function setHotCache(semanticKeyHash, mapping) {
  try {
    if (mapping && mapping.semanticKey) {
      localMockCache.set(mapping.semanticKey, mapping);
    }
    localMockCache.set(semanticKeyHash, mapping);
    const redis = getRedis();
    const redisKey = `semantic:exact:${semanticKeyHash}`;
    // Only store safe metadata, no user profile values
    const safeData = {
      mappingId: mapping.mappingId,
      profileField: mapping.profileField,
      entity: mapping.entity,
      attribute: mapping.attribute,
      confidence: mapping.confidence,
      ruleVersion: mapping.ruleVersion,
      validatedCount: mapping.validatedCount,
      validationState: mapping.validationState
    };
    await redis.set(redisKey, JSON.stringify(safeData), { ex: REDIS_TTL });
  } catch (error) {
    console.error('Redis hot cache set error:', error);
  }
}

async function getExactMapping(semanticKey) {
  if (localMockCache.has(semanticKey)) {
    return localMockCache.get(semanticKey);
  }

  try {
    const client = docClient;
    const command = new QueryCommand({
      TableName: tableName,
      IndexName: 'SemanticKeyIndex',
      KeyConditionExpression: 'semanticKey = :sk',
      ExpressionAttributeValues: {
        ':sk': semanticKey
      },
      Limit: 1
    });

    const result = await client.send(command);
    if (result.Items && result.Items.length > 0) {
      localMockCache.set(semanticKey, result.Items[0]);
      return result.Items[0];
    }
    return null;
  } catch (error) {
    return localMockCache.get(semanticKey) || null;
  }
}

async function saveMapping(mapping) {
  if (mapping && mapping.semanticKey) {
    localMockCache.set(mapping.semanticKey, mapping);
  }
  try {
    const client = docClient;
    const command = new PutCommand({
      TableName: tableName,
      Item: mapping
    });
    await client.send(command);
  } catch (error) {
  }
}

async function updateMappingFeedback(mappingId, accepted, correctProfileField) {
  let updated = null;
  
  for (const [key, val] of localMockCache.entries()) {
    if (val.mappingId === mappingId) {
      val.validatedCount = (val.validatedCount || 0) + (accepted ? 1 : 0);
      val.validationState = accepted ? 'validated' : 'rejected';
      val.lastValidatedAt = new Date().toISOString();
      if (accepted && correctProfileField) {
        val.profileField = correctProfileField;
      }
      updated = val;
      localMockCache.set(key, val);
      break;
    }
  }

  try {
    const client = docClient;
    
    let updateExpr = 'SET validatedCount = validatedCount + :inc, validationState = :state, lastValidatedAt = :now';
    const exprVals = {
      ':inc': accepted ? 1 : 0,
      ':state': accepted ? 'validated' : 'rejected',
      ':now': new Date().toISOString()
    };
    
    if (accepted && correctProfileField) {
      updateExpr += ', profileField = :pf';
      exprVals[':pf'] = correctProfileField;
    }

    const command = new UpdateCommand({
      TableName: tableName,
      Key: { mappingId },
      UpdateExpression: updateExpr,
      ExpressionAttributeValues: exprVals,
      ReturnValues: 'ALL_NEW'
    });

    const result = await client.send(command);
    return result.Attributes;
  } catch (error) {
    console.error('DynamoDB semantic cache update error:', error);
    return updated;
  }
}

// Simple in-memory metrics for local testing
const localMetrics = {
  deterministicResolved: 0,
  semanticCacheHits: 0,
  semanticCacheMisses: 0,
  vectorSearchHits: 0,
  llmFallbacks: 0,
  ambiguous: 0,
  validationsAccepted: 0,
  validationsRejected: 0
};

async function incrementMetric(metricName) {
  try {
    if (localMetrics[metricName] !== undefined) {
      localMetrics[metricName]++;
    }
    const redis = getRedis();
    await redis.incr(`intelligence:metrics:${metricName}`);
  } catch (e) {
    // ignore
  }
}

async function getMetrics() {
  try {
    const redis = getRedis();
    const keys = [
      'deterministicResolved',
      'semanticCacheHits',
      'semanticCacheMisses',
      'vectorSearchHits',
      'llmFallbacks',
      'ambiguous',
      'validationsAccepted',
      'validationsRejected'
    ];
    const metrics = {};
    for (const key of keys) {
      const val = await redis.get(`intelligence:metrics:${key}`);
      metrics[key] = parseInt(val || '0', 10);
    }
    return metrics;
  } catch (error) {
    console.error('Redis metrics error:', error);
    return {};
  }
}

module.exports = {
  getFromHotCache,
  setHotCache,
  getExactMapping,
  saveMapping,
  updateMappingFeedback,
  incrementMetric,
  getMetrics
};
