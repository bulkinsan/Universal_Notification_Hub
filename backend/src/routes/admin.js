const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { queryAll, queryOne, run } = require('../db');
const { hashApiKey } = require('../middleware/auth');
const { requireAdminAuth, issueToken, verifyAdminCredentials } = require('../middleware/adminAuth');
const { loginLimiter } = require('../middleware/rateLimit');
const { generateApiKey } = require('../utils/security');
const logoService = require('../services/logo');
const {
  validateCreateSource,
  validateSourceInput,
  validateLogin,
  validateId,
} = require('../services/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const check = validateLogin(req.body);
    if (!check.ok) return res.status(400).json({ error: check.errors.join('; ') });

    const { username, password } = req.body;
    if (!verifyAdminCredentials(username, password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = issueToken(username);
    res.json({ token, username });
  } catch (err) {
    console.error('POST /api/v1/admin/login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', requireAdminAuth, (req, res) => {
  res.json({ username: req.admin.username, role: 'admin' });
});

router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const stats = queryOne(`
      SELECT
        (SELECT COUNT(*) FROM traffic_sources) AS sources_total,
        (SELECT COUNT(*) FROM traffic_sources WHERE is_active = 1) AS sources_active,
        (SELECT COUNT(*) FROM users) AS users_total,
        (SELECT COUNT(*) FROM user_subscriptions WHERE is_active = 1) AS subscriptions_active,
        (SELECT COUNT(*) FROM notifications) AS notifications_total,
        (SELECT COUNT(*) FROM notification_deliveries WHERE status = 'sent') AS deliveries_sent,
        (SELECT COUNT(*) FROM notification_deliveries WHERE status = 'failed') AS deliveries_failed
    `);
    res.json(stats);
  } catch (err) {
    console.error('GET /api/v1/admin/stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sources', requireAdminAuth, async (req, res) => {
  try {
    const sources = queryAll(`
      SELECT ts.id, ts.name, ts.domain, ts.logo_path, ts.description, ts.website_url,
             ts.is_active, ts.created_at, ts.updated_at,
             (SELECT COUNT(*) FROM user_subscriptions us
              WHERE us.source_id = ts.id AND us.is_active = 1) AS subscribers_count
      FROM traffic_sources ts
      ORDER BY ts.created_at DESC
    `);
    res.json(sources);
  } catch (err) {
    console.error('GET /api/v1/admin/sources error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sources', requireAdminAuth, async (req, res) => {
  try {
    const check = validateCreateSource(req.body);
    if (!check.ok) return res.status(400).json({ error: check.errors.join('; ') });

    const { name, domain, description, website_url } = req.body;
    const existing = queryOne('SELECT id FROM traffic_sources WHERE domain = ?', [domain]);
    if (existing) return res.status(409).json({ error: 'Source with this domain already exists' });

    const id = uuidv4();
    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);

    run(
      'INSERT INTO traffic_sources (id, name, domain, api_key_hash, description, website_url, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, name, domain, keyHash, description || null, website_url || null]
    );

    res.status(201).json({
      id,
      name,
      domain,
      api_key: rawKey,
      description: description || null,
      website_url: website_url || null,
    });
  } catch (err) {
    console.error('POST /api/v1/admin/sources error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sources/:id', requireAdminAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid source id' });

    const source = queryOne(`
      SELECT ts.id, ts.name, ts.domain, ts.logo_path, ts.description, ts.website_url,
             ts.is_active, ts.created_at, ts.updated_at,
             (SELECT COUNT(*) FROM user_subscriptions us
              WHERE us.source_id = ts.id AND us.is_active = 1) AS subscribers_count
      FROM traffic_sources ts WHERE ts.id = ?
    `, [req.params.id]);

    if (!source) return res.status(404).json({ error: 'Source not found' });
    res.json(source);
  } catch (err) {
    console.error('GET /api/v1/admin/sources/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/sources/:id', requireAdminAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid source id' });

    const check = validateSourceInput(req.body);
    if (!check.ok) return res.status(400).json({ error: check.errors.join('; ') });

    const allowed = ['name', 'description', 'website_url'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(req.body[key]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No valid fields to update' });

    sets.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(req.params.id);

    run(`UPDATE traffic_sources SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ message: 'Updated' });
  } catch (err) {
    console.error('PATCH /api/v1/admin/sources/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sources/:id/logo', requireAdminAuth, upload.single('logo'), async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid source id' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const source = queryOne('SELECT * FROM traffic_sources WHERE id = ?', [req.params.id]);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    if (source.logo_path) logoService.delete(source.logo_path);

    const logoPath = await logoService.save(req.params.id, req.file);
    run('UPDATE traffic_sources SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [logoPath, req.params.id]);

    res.json({ logo_path: logoPath });
  } catch (err) {
    console.error('POST /api/v1/admin/sources/:id/logo error:', err);
    if (err instanceof logoService.LogoValidationError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

router.post('/sources/:id/activate', requireAdminAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid source id' });
    run('UPDATE traffic_sources SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ status: 'active' });
  } catch (err) {
    console.error('POST /api/v1/admin/sources/:id/activate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sources/:id/deactivate', requireAdminAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid source id' });
    run('UPDATE traffic_sources SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ status: 'inactive' });
  } catch (err) {
    console.error('POST /api/v1/admin/sources/:id/deactivate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/sources/:id/api-key', requireAdminAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid source id' });

    const source = queryOne('SELECT id FROM traffic_sources WHERE id = ?', [req.params.id]);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const rawKey = generateApiKey();
    const keyHash = hashApiKey(rawKey);
    run('UPDATE traffic_sources SET api_key_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [keyHash, req.params.id]);

    res.json({ api_key: rawKey, message: 'Old API key is now invalid' });
  } catch (err) {
    console.error('POST /api/v1/admin/sources/:id/api-key error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/sources/:id/stats', requireAdminAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid source id' });

    const stats = queryOne(`
      SELECT
        ts.id, ts.name,
        (SELECT COUNT(*) FROM user_subscriptions us
         WHERE us.source_id = ts.id AND us.is_active = 1) AS subscribers,
        (SELECT COUNT(*) FROM notifications n WHERE n.source_id = ts.id) AS notifications_total,
        (SELECT COUNT(*) FROM notifications n
         JOIN notification_deliveries d ON d.notification_id = n.id
         WHERE n.source_id = ts.id AND d.status = 'sent') AS deliveries_sent,
        (SELECT COUNT(*) FROM notifications n
         JOIN notification_deliveries d ON d.notification_id = n.id
         WHERE n.source_id = ts.id AND d.status = 'failed') AS deliveries_failed
      FROM traffic_sources ts WHERE ts.id = ?
    `, [req.params.id]);

    if (!stats) return res.status(404).json({ error: 'Source not found' });
    res.json(stats);
  } catch (err) {
    console.error('GET /api/v1/admin/sources/:id/stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications', requireAdminAuth, async (req, res) => {
  try {
    const { source_id, status } = req.query;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const where = [];
    const params = [];
    if (source_id) {
      if (!validateId(source_id)) return res.status(400).json({ error: 'Invalid source_id' });
      where.push('n.source_id = ?');
      params.push(source_id);
    }
    if (status) {
      where.push('n.status = ?');
      params.push(status);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const rows = queryAll(`
      SELECT n.id, n.source_id, ts.name AS source_name, n.title, n.body, n.icon_url,
             n.status, n.created_at
      FROM notifications n
      JOIN traffic_sources ts ON n.source_id = ts.id
      ${whereSql}
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json(rows);
  } catch (err) {
    console.error('GET /api/v1/admin/notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications/:id', requireAdminAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) return res.status(400).json({ error: 'Invalid notification id' });

    const notification = queryOne(`
      SELECT n.*, ts.name AS source_name, ts.domain AS source_domain
      FROM notifications n
      JOIN traffic_sources ts ON n.source_id = ts.id
      WHERE n.id = ?
    `, [req.params.id]);

    if (!notification) return res.status(404).json({ error: 'Notification not found' });

    const deliveries = queryAll(`
      SELECT d.id, d.user_id, u.device_type, d.status, d.sent_at, d.error
      FROM notification_deliveries d
      JOIN users u ON d.user_id = u.id
      WHERE d.notification_id = ?
    `, [req.params.id]);

    res.json({ ...notification, deliveries });
  } catch (err) {
    console.error('GET /api/v1/admin/notifications/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
