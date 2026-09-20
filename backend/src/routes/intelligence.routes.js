const express = require('express');
const { resolve, feedback, metrics } = require('../controllers/intelligence.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.post('/resolve', authenticate, resolve);
router.post('/feedback', authenticate, feedback);
router.get('/metrics', authenticate, metrics);

module.exports = router;
