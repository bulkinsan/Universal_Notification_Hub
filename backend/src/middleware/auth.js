const crypto = require('crypto');
const { queryOne } = require('../db');

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

async function requireSourceAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const keyHash = hashApiKey(apiKey);
  const source = queryOne(
    'SELECT * FROM traffic_sources WHERE api_key_hash = ? AND is_active = 1',
    [keyHash]
  );

  if (!source) {
    return res.status(403).json({ error: 'Invalid or inactive API key' });
  }

  req.source = source;
  next();
}

module.exports = { requireSourceAuth, hashApiKey };
