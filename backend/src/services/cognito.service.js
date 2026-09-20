/**
 * Amazon Cognito service.
 * Handles user registration, email confirmation, and authentication.
 *
 * Uses AWS SDK v3 with a public app client (no client secret).
 */

const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} = require('@aws-sdk/client-cognito-identity-provider');
const config = require('../config/env');

const cognitoClient = new CognitoIdentityProviderClient({
  region: config.awsRegion,
});

/**
 * Register a new user with Cognito.
 * @param {string} email - User's email address (used as username).
 * @param {string} password - User's chosen password.
 * @returns {Promise<object>} Cognito SignUp response.
 */
async function register(email, password) {
  const command = new SignUpCommand({
    ClientId: config.cognitoClientId,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
    ],
  });

  return cognitoClient.send(command);
}

/**
 * Confirm a user's email with the verification code sent by Cognito.
 * @param {string} email - User's email address.
 * @param {string} code - 6-digit confirmation code.
 * @returns {Promise<object>} Cognito ConfirmSignUp response.
 */
async function confirmSignUp(email, code) {
  const command = new ConfirmSignUpCommand({
    ClientId: config.cognitoClientId,
    Username: email,
    ConfirmationCode: code,
  });

  return cognitoClient.send(command);
}

/**
 * Authenticate a user and retrieve Cognito tokens.
 * Uses USER_PASSWORD_AUTH flow (must be enabled on the Cognito app client).
 * @param {string} email - User's email address.
 * @param {string} password - User's password.
 * @returns {Promise<object>} Cognito authentication result with tokens.
 */
async function login(email, password) {
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: config.cognitoClientId,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password,
    },
  });

  return cognitoClient.send(command);
}

module.exports = { register, confirmSignUp, login };
