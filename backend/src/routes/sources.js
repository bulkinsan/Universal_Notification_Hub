const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { queryAll, queryOne, run } = require('../db');
const { hashApiKey, requireSourceAuth } = require('../middleware/auth');
const { generateApiKey } = require('../utils/security');
const logoService = require('../services/logo');
const { validateCreateSource, validateSourceInput, validateId } = require('../services/validate');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/', async (req, res) => {
  try {
    const check = validateCreateSource(req.body);
    if (!check.ok) {
      return res.status(400).json({ error: check.errors.join('; ') });
    }

    const { name, domain, description, website_url } = req.body;

    const existing = queryOne('SELECT id FROM traffic_sources WHERE domain = ?', [domain]);
    if (existing) {
      return res.status(409).json({ error: 'Source with this domain already exists' });
    }

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
    console.error('POST /api/v1/sources error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const sources = queryAll(
      'SELECT id, name, domain, logo_path, description, website_url, created_at FROM traffic_sources WHERE is_active = 1 ORDER BY name ASC'
    );
    res.json(sources);
  } catch (err) {
    console.error('GET /api/v1/sources error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    if (!validateId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid source id' });
    }

    const source = queryOne(
      'SELECT id, name, domain, logo_path, description, website_url, is_active, created_at FROM traffic_sources WHERE id = ?',
      [req.params.id]
    );

    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    res.json(source);
  } catch (err) {
    console.error('GET /api/v1/sources/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id', requireSourceAuth, async (req, res) => {
  try {
    if (!validateId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid source id' });
    }

    const check = validateSourceInput(req.body);
    if (!check.ok) {
      return res.status(400).json({ error: check.errors.join('; ') });
    }

    const allowed = ['name', 'description', 'website_url'];
    const sets = [];
    const vals = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(req.body[key]);
      }
    }

    if (sets.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    vals.push(req.params.id);

    run(
      `UPDATE traffic_sources SET ${sets.join(', ')} WHERE id = ?`,
      vals
    );

    res.json({ message: 'Updated' });
  } catch (err) {
    console.error('PATCH /api/v1/sources/:id error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/logo', requireSourceAuth, upload.single('logo'), async (req, res) => {
  try {
    if (!validateId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid source id' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const source = queryOne('SELECT * FROM traffic_sources WHERE id = ?', [req.params.id]);
    if (!source) {
      return res.status(404).json({ error: 'Source not found' });
    }

    if (source.logo_path) {
      logoService.delete(source.logo_path);
    }

    const logoPath = await logoService.save(req.params.id, req.file);

    run(
      'UPDATE traffic_sources SET logo_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [logoPath, req.params.id]
    );

    res.json({ logo_path: logoPath });
  } catch (err) {
    console.error('POST /api/v1/sources/:id/logo error:', err);
    if (err instanceof logoService.LogoValidationError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

module.exports = router;
