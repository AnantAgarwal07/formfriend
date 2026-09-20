/**
 * AWS Lambda entry point.
 * Wraps the Express app with serverless-http so it can run behind API Gateway.
 *
 * API Gateway → Lambda handler → Express app
 *
 * No business logic here — all logic lives in controllers/services.
 */

const serverless = require('serverless-http');
const app = require('./app');

module.exports.handler = serverless(app);
