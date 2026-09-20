/**
 * Authentication routes.
 * All routes are public (no JWT required).
 */

const { Router } = require('express');
const authController = require('../controllers/auth.controller');

const router = Router();

// POST /auth/register — Register a new user
router.post('/register', authController.register);

// POST /auth/confirm — Confirm email with verification code
router.post('/confirm', authController.confirm);

// POST /auth/login — Authenticate and receive tokens
router.post('/login', authController.login);

module.exports = router;
