/**
 * Profile controller (Client-Side Encryption Edition).
 * Handles saving and retrieving encrypted user profiles (cloud bundles).
 * The backend never sees the plaintext profile.
 */

const dynamodbService = require('../services/dynamodb.service');
const redisService = require('../services/redis.service');

/**
 * PUT /profile
 * Save the authenticated user's client-side encrypted bundle.
 */
async function saveProfile(req, res) {
  try {
    const userId = req.userId; // Set by auth middleware from JWT sub
    const cloudBundle = req.body;

    // Validate that this is a valid crypto bundle
    if (!cloudBundle || !cloudBundle.encryptedProfile || !cloudBundle.wrappedDek) {
      return res.status(400).json({ error: 'Invalid client-side crypto bundle.' });
    }

    // Force the userId in the bundle to match the authenticated user
    cloudBundle.userId = userId;

    // Save to DynamoDB (source of truth)
    await dynamodbService.saveProfile(userId, cloudBundle);

    // Update Redis cache
    await redisService.setCachedProfile(userId, {
      ...cloudBundle,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      message: 'Encrypted profile saved successfully',
    });
  } catch (err) {
    console.error('Save profile error:', err);
    return res.status(500).json({ error: 'Failed to save encrypted profile' });
  }
}

/**
 * GET /profile
 * Retrieve the authenticated user's client-side encrypted bundle.
 */
async function getProfile(req, res) {
  try {
    const userId = req.userId;

    // 1: Check Redis cache
    const cachedBundle = await redisService.getCachedProfile(userId);

    if (cachedBundle) {
      return res.status(200).json({
        source: 'cache',
        cloudBundle: cachedBundle,
      });
    }

    // 2: Redis MISS ?" fetch from DynamoDB
    const dynamoItem = await dynamodbService.getProfile(userId);

    if (!dynamoItem || !dynamoItem.encryptedProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // dynamoItem contains the saved cloudBundle (because we pass the whole object to saveProfile)
    const cloudBundle = dynamoItem.encryptedProfile; // Because dynamodbService puts the second arg in `encryptedProfile` property!

    // 3: Populate Redis cache
    await redisService.setCachedProfile(userId, {
      ...cloudBundle,
      updatedAt: dynamoItem.updatedAt,
    });

    // 4: Return bundle to client for local decryption
    return res.status(200).json({
      source: 'dynamodb',
      cloudBundle,
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Failed to retrieve encrypted profile' });
  }
}

module.exports = { saveProfile, getProfile };
