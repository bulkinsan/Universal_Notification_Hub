const express = require('express');
const { queryAll } = require('../db');
const { validateId } = require('../services/validate');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id || !validateId(user_id)) {
      return res.status(400).json({ error: 'valid user_id query param is required' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const notifications = queryAll(`
      SELECT n.id, n.source_id, ts.name AS source_name, ts.domain AS source_domain,
             n.title, n.body, n.icon_url, n.data, n.status, n.created_at
      FROM notification_deliveries d
      JOIN notifications n ON d.notification_id = n.id
      JOIN traffic_sources ts ON n.source_id = ts.id
      WHERE d.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ? OFFSET ?
    `, [user_id, limit, offset]);

    res.json(notifications);
  } catch (err) {
    console.error('GET /api/v1/notifications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
