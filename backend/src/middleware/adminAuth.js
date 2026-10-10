const jwt = require('jsonwebtoken');
const config = require('../config');
const { timingSafeEqualString } = require('../utils/security');

function getJwtSecret() {
  if (config.jwt.secret) return config.jwt.secret;
  if (config.nodeEnv === 'production') {
    console.error('[security] JWT_SECRET is required in production. Set JWT_SECRET in .env.');
    process.exit(1);
  }
  console.warn('[security] JWT_SECRET is not set — using ephemeral secret (sessions reset on restart). Set JWT_SECRET in .env.');
  return 'dev-ephemeral-secret-' + process.pid;
}

function issueToken(username) {
  return jwt.sign({ sub: username, role: 'admin' }, getJwtSecret(), {
    expiresIn: config.jwt.expiresIn,
  });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

function verifyAdminCredentials(username, password) {
  const cfgUser = config.admin.username;
  const cfgPass = config.admin.password;
  if (!cfgPass) {
    console.warn('[security] ADMIN_PASSWORD is not set — admin login disabled.');
    return false;
  }
  if (!timingSafeEqualString(username, cfgUser)) return false;
  if (!timingSafeEqualString(password, cfgPass)) return false;
  return true;
}

function requireAdminAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const payload = verifyToken(token);
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.admin = { username: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { issueToken, verifyToken, verifyAdminCredentials, requireAdminAuth };
