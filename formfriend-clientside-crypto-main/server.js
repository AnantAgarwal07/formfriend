const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'profiles.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readProfiles() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeProfiles(profiles) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(profiles, null, 2));
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'mock-backend' });
});

// This endpoint intentionally stores only the encrypted bundle.
// It does NOT decrypt anything.
app.put('/profile', (req, res) => {
  const { userId, bundle } = req.body || {};
  if (!userId || !bundle || typeof bundle !== 'object') {
    return res.status(400).json({ error: 'userId and bundle are required' });
  }

  const profiles = readProfiles();
  profiles[userId] = {
    bundle,
    updatedAt: new Date().toISOString()
  };
  writeProfiles(profiles);

  res.json({ message: 'Encrypted profile stored', userId });
});

app.get('/profile', (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const profiles = readProfiles();
  const record = profiles[userId];
  if (!record) return res.status(404).json({ error: 'Profile not found' });

  // Deliberately return ciphertext bundle as-is.
  res.json(record.bundle);
});

app.listen(PORT, () => {
  console.log(`FormFriend crypto E2E test backend: http://localhost:${PORT}`);
  console.log(`Stored encrypted bundles: ${DATA_FILE}`);
});
