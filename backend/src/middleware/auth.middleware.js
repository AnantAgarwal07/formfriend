/**
 * JWT authentication middleware.
 * Verifies Cognito-issued JWTs using aws-jwt-verify.
 */

const { CognitoJwtVerifier } = require('aws-jwt-verify');
const { SimpleJwksCache } = require('aws-jwt-verify/jwk');
const { SimpleJsonFetcher } = require('aws-jwt-verify/https');
const config = require('../config/env');

const verifier = CognitoJwtVerifier.create({
    userPoolId: config.cognitoUserPoolId,
    tokenUse: 'id',
    clientId: config.cognitoClientId,
  }, {
    jwksCache: new SimpleJwksCache({
      fetcher: new SimpleJsonFetcher({ defaultRequestOptions: { responseTimeout: 10000 } }),
    }),
});

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // HACKATHON DEMO BYPASS
  if (authHeader === 'Bearer DEMO_TOKEN') {
    req.userId = 'demo-user-123';
    return next();
  }

  try {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
    }
    const token = authHeader.split(' ')[1];
    const payload = await verifier.verify(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
