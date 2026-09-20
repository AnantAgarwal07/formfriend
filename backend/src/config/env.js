/**
 * Centralized environment configuration loader.
 * Loads .env in development mode and validates required variables.
 */

const path = require('path');

// Load .env file in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
}

const required = [
  'AWS_REGION',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
  'DYNAMODB_TABLE_NAME',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'ENCRYPTION_KEY_B64',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`\n❌  Missing required environment variables:\n   ${missing.join('\n   ')}\n`);
  console.error('   Copy .env.example to .env and fill in all values.\n');
  process.exit(1);
}

const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,

  // AWS
  awsRegion: process.env.AWS_REGION,

  // Cognito
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID,
  cognitoClientId: process.env.COGNITO_CLIENT_ID,

  // DynamoDB
  dynamoTableName: process.env.DYNAMODB_TABLE_NAME,

  // Upstash Redis
  redisUrl: process.env.UPSTASH_REDIS_REST_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN,
  redisTtlSeconds: parseInt(process.env.REDIS_PROFILE_TTL_SECONDS, 10) || 3600,

  // Encryption
  encryptionKeyB64: process.env.ENCRYPTION_KEY_B64,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
});

module.exports = config;
