/**
 * JWT authentication middleware.
 * Verifies Cognito-issued JWTs using aws-jwt-verify.
 *
 * On success, attaches `req.userId` (Cognito sub) for downstream handlers.
 * On failure, returns 401 Unauthorized.
 */

const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { SimpleJwksCache } = require('aws-jwt-verify/jwk');
const { SimpleJsonFetcher } = require('aws-jwt-verify/https');
const config = require('../config/env');

// Create verifier once at module load — it caches JWKS internally
const verifier = CognitoJwtVerifier.create(
  {
    userPoolId: config.cognitoUserPoolId,
    tokenUse: 'id', // We use the ID token for profile access
    clientId: config.cognitoClientId,
  },
  {
    jwksCache: new SimpleJwksCache({
      fetcher: new SimpleJsonFetcher({
        defaultRequestOptions: {
          responseTimeout: 10000, // Increase timeout to 10 seconds for slow network/AWS response
        },
      }),
    }),
  }
);

/**
 * Express middleware that verifies the Authorization: Bearer <JWT> header.
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify signature, expiration, audience, and issuer
    const payload = await verifier.verify(token);

    // Attach the Cognito `sub` as the internal userId
    req.userId = payload.sub;

    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
