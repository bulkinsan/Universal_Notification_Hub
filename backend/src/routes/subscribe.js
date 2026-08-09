const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../db');
const { validateSubscribe, validateUnsubscribe, validateId } = require('../services/validate');
const { subscribeLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/', subscribeLimiter, async (req, res) => {
  try {
    const check = validateSubscribe(req.body);
    if (!check.ok) {
      return res.status(400).json({ error: check.errors.join('; ') });
    }

    const { source_id, device_type, push_subscription, user_agent } = req.body;

    const source = queryOne('SELECT id FROM traffic_sources WHERE id = ? AND is_active = 1', [source_id]);
    if (!source) {
      return res.status(404).json({ error: 'Source not found or inactive' });
    }

    const userId = req.body.user_id || uuidv4();
    const existingUser = queryOne('SELECT id FROM users WHERE id = ?', [userId]);

    if (!existingUser) {
      run(
        'INSERT INTO users (id, device_type, push_subscription, user_agent) VALUES (?, ?, ?, ?)',
        [userId, device_type, push_subscription ? JSON.stringify(push_subscription) : null, user_agent || null]
      );
    } else {
      const subJson = push_subscription ? JSON.stringify(push_subscription) : null;
      if (subJson) {
        run('UPDATE users SET device_type = ?, push_subscription = ?, user_agent = COALESCE(?, user_agent), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [device_type, subJson, user_agent || null, userId]);
      } else {
        run('UPDATE users SET device_type = ?, user_agent = COALESCE(?, user_agent), updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [device_type, user_agent || null, userId]);
      }
    }

    const existingSub = queryOne('SELECT id, is_active FROM user_subscriptions WHERE user_id = ? AND source_id = ?', [userId, source_id]);

    if (existingSub) {
      if (!existingSub.is_active) {
        run('UPDATE user_subscriptions SET is_active = 1 WHERE id = ?', [existingSub.id]);
      }
    } else {
      run('INSERT INTO user_subscriptions (id, user_id, source_id, is_active) VALUES (?, ?, ?, 1)',
        [uuidv4(), userId, source_id]);
    }

    res.json({ user_id: userId, source_id, status: 'subscribed' });
  } catch (err) {
    console.error('POST /api/v1/subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/', async (req, res) => {
  try {
    const check = validateUnsubscribe(req.body);
    if (!check.ok) {
      return res.status(400).json({ error: check.errors.join('; ') });
    }

    const { user_id, source_id } = req.body;

    run(
      'UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ? AND source_id = ?',
      [user_id, source_id]
    );

    res.json({ status: 'unsubscribed' });
  } catch (err) {
    console.error('DELETE /api/v1/subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id || !validateId(user_id)) {
      return res.status(400).json({ error: 'valid user_id query param is required' });
    }

    const subs = queryAll(
      `SELECT ts.id, ts.name, ts.domain, ts.logo_path, ts.description, ts.website_url, us.created_at as subscribed_at
       FROM user_subscriptions us
       JOIN traffic_sources ts ON us.source_id = ts.id
       WHERE us.user_id = ? AND us.is_active = 1`,
      [user_id]
    );

    res.json(subs);
  } catch (err) {
    console.error('GET /api/v1/subscribe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
