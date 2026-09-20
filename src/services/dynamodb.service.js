/**
 * Amazon DynamoDB service.
 * Handles reading and writing encrypted profile data to the Profiles table.
 *
 * Uses AWS SDK v3 Document Client for simplified item marshalling.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const config = require('../config/env');

const ddbClient = new DynamoDBClient({ region: config.awsRegion });
const docClient = DynamoDBDocumentClient.from(ddbClient);

/**
 * Save an encrypted profile to DynamoDB.
 * @param {string} userId - Cognito sub (partition key).
 * @param {object} encryptedProfile - Encrypted envelope { version, algorithm, iv, authTag, ciphertext }.
 * @returns {Promise<void>}
 */
async function saveProfile(userId, encryptedProfile) {
  const command = new PutCommand({
    TableName: config.dynamoTableName,
    Item: {
      userId,
      encryptedProfile,
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
    },
  });

  await docClient.send(command);
}

/**
 * Retrieve an encrypted profile from DynamoDB.
 * @param {string} userId - Cognito sub (partition key).
 * @returns {Promise<object|null>} The full DynamoDB item, or null if not found.
 */
async function getProfile(userId) {
  const command = new GetCommand({
    TableName: config.dynamoTableName,
    Key: { userId },
  });

  const result = await docClient.send(command);
  return result.Item || null;
}

module.exports = { saveProfile, getProfile, docClient };
