/**
 * Express application — used by both the local server and the Lambda handler.
 * Contains all route mounting, middleware, and error handling.
 */

const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const intelligenceRoutes = require('./routes/intelligence.routes');

const app = express();

// ── Middleware ──────────────────────────────────
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

// ── Health check ───────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ─────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/profile', profileRoutes);
app.use('/intelligence', intelligenceRoutes);

// ── 404 handler ────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ───────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
