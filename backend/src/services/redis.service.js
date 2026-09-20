/**
 * Upstash Redis cache service.
 * Stores and retrieves encrypted profile envelopes.
 *
 * Uses @upstash/redis (HTTP-based, connectionless client).
 * Gracefully degrades — if Redis is unavailable, operations return null / silently fail.
 */

const { Redis } = require('@upstash/redis');
const config = require('../config/env');

const redis = new Redis({
  url: config.redisUrl,
  token: config.redisToken,
});

/**
 * Build the Redis key for a user's cached profile.
 * @param {string} userId
 * @returns {string}
 */
function profileKey(userId) {
  return `profile:${userId}`;
}

/**
 * Retrieve a cached encrypted profile from Redis.
 * @param {string} userId - Cognito sub.
 * @returns {Promise<object|null>} Encrypted envelope or null on miss/error.
 */
async function getCachedProfile(userId) {
  try {
    const data = await redis.get(profileKey(userId));
    if (!data) return null;

    // @upstash/redis auto-deserialises JSON, so data is already an object
    return typeof data === 'string' ? JSON.parse(data) : data;
  } catch (err) {
    console.warn('Redis GET failed (falling back to DynamoDB):', err.message);
    return null;
  }
}

/**
 * Cache an encrypted profile envelope in Redis with TTL.
 * @param {string} userId - Cognito sub.
 * @param {object} encryptedEnvelope - Encrypted profile envelope.
 * @returns {Promise<void>}
 */
async function setCachedProfile(userId, encryptedEnvelope) {
  try {
    await redis.set(profileKey(userId), JSON.stringify(encryptedEnvelope), {
      ex: config.redisTtlSeconds,
    });
  } catch (err) {
    // Redis failure is non-fatal — DynamoDB is the source of truth
    console.warn('Redis SET failed (profile still saved in DynamoDB):', err.message);
  }
}

/**
 * Delete a cached profile from Redis.
 * @param {string} userId - Cognito sub.
 * @returns {Promise<void>}
 */
async function deleteCachedProfile(userId) {
  try {
    await redis.del(profileKey(userId));
  } catch (err) {
    console.warn('Redis DEL failed:', err.message);
  }
}

module.exports = { getCachedProfile, setCachedProfile, deleteCachedProfile };
