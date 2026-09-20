/**
 * Authentication controller.
 * Handles HTTP requests for registration, email confirmation, and login.
 */

const cognitoService = require('../services/cognito.service');

/**
 * POST /auth/register
 * Register a new user with Cognito.
 */
async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await cognitoService.register(email, password);

    return res.status(201).json({
      message: 'User registered successfully',
      userSub: result.UserSub,
      userConfirmed: result.UserConfirmed,
      confirmationRequired: !result.UserConfirmed,
      codeDeliveryDetails: result.CodeDeliveryDetails
        ? {
            destination: result.CodeDeliveryDetails.Destination,
            medium: result.CodeDeliveryDetails.DeliveryMedium,
            attribute: result.CodeDeliveryDetails.AttributeName,
          }
        : null,
    });
  } catch (err) {
    console.error('Register error:', err);

    if (err.name === 'UsernameExistsException') {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }
    if (err.name === 'InvalidPasswordException') {
      return res.status(400).json({ error: err.message });
    }
    if (err.name === 'InvalidParameterException') {
      return res.status(400).json({ error: err.message });
    }

    return res.status(500).json({ error: 'Registration failed' });
  }
}

/**
 * POST /auth/confirm
 * Confirm a user's email with the verification code.
 */
async function confirm(req, res) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'email and code are required' });
    }

    await cognitoService.confirmSignUp(email, code);

    return res.status(200).json({
      message: 'Email confirmed successfully. You can now log in.',
    });
  } catch (err) {
    console.error('Confirm error:', err);

    if (err.name === 'CodeMismatchException') {
      return res.status(400).json({ error: 'Invalid confirmation code' });
    }
    if (err.name === 'ExpiredCodeException') {
      return res.status(400).json({ error: 'Confirmation code has expired. Please request a new one.' });
    }
    if (err.name === 'UserNotFoundException') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (err.name === 'NotAuthorizedException') {
      return res.status(400).json({ error: 'User is already confirmed' });
    }

    return res.status(500).json({ error: 'Confirmation failed' });
  }
}

/**
 * POST /auth/login
 * Authenticate a user and return Cognito tokens.
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await cognitoService.login(email, password);
    const authResult = result.AuthenticationResult;

    return res.status(200).json({
      message: 'Login successful',
      idToken: authResult.IdToken,
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken,
      expiresIn: authResult.ExpiresIn,
      tokenType: authResult.TokenType,
    });
  } catch (err) {
    console.error('Login error:', err);

    if (err.name === 'NotAuthorizedException') {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }
    if (err.name === 'UserNotConfirmedException') {
      return res.status(403).json({ error: 'Email not confirmed. Please confirm your email first.' });
    }
    if (err.name === 'UserNotFoundException') {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(500).json({ error: 'Login failed' });
  }
}

module.exports = { register, confirm, login };
