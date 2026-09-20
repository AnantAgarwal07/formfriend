/**
 * Profile routes.
 * All routes are protected by JWT authentication middleware.
 */

const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const profileController = require('../controllers/profile.controller');

const router = Router();

// All profile routes require authentication
router.use(authenticate);

// PUT /profile — Save or update profile
router.put('/', profileController.saveProfile);

// GET /profile — Retrieve profile (Redis → DynamoDB fallback)
router.get('/', profileController.getProfile);

module.exports = router;
