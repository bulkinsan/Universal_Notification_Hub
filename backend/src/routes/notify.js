const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { queryAll, queryOne, run } = require('../db');
const { requireSourceAuth } = require('../middleware/auth');
const { notifyLimiter } = require('../middleware/rateLimit');
const { validateNotify } = require('../services/validate');
const delivery = require('../services/delivery');
const config = require('../config');

const router = express.Router();

router.post('/', requireSourceAuth, notifyLimiter, async (req, res) => {
  try {
    const check = validateNotify(req.body);
    if (!check.ok) {
      return res.status(400).json({ error: check.errors.join('; ') });
    }

    const { title, body, data } = req.body;
    const source = req.source;

    const notificationId = uuidv4();
    const iconUrl = source.logo_path
      ? `${config.baseUrl}/uploads/${source.logo_path}`
      : null;

    const notification = {
      id: notificationId,
      source_id: source.id,
      title,
      body: body || '',
      icon_url: iconUrl,
      data: data ? JSON.stringify(data) : null,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    run(
      'INSERT INTO notifications (id, source_id, title, body, icon_url, data, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [notification.id, notification.source_id, notification.title, notification.body, notification.icon_url, notification.data, notification.status, notification.created_at]
    );

    const subscribers = queryAll(
      `SELECT u.* FROM user_subscriptions us
       JOIN users u ON us.user_id = u.id
       WHERE us.source_id = ? AND us.is_active = 1`,
      [source.id]
    );

    let sent = 0;
    let failed = 0;

    for (const user of subscribers) {
      try {
        const result = await delivery.send(user, notification);
        if (result.success) {
          sent++;
          run(
            'INSERT INTO notification_deliveries (id, notification_id, user_id, status, sent_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [uuidv4(), notificationId, user.id, 'sent']
          );
        } else if (result.expired) {
          failed++;
          run(
            'INSERT INTO notification_deliveries (id, notification_id, user_id, status, error) VALUES (?, ?, ?, ?, ?)',
            [uuidv4(), notificationId, user.id, 'failed', result.error]
          );
          run('UPDATE user_subscriptions SET is_active = 0 WHERE user_id = ? AND source_id = ?',
            [user.id, source.id]);
        }
      } catch (err) {
        failed++;
        run(
          'INSERT INTO notification_deliveries (id, notification_id, user_id, status, error) VALUES (?, ?, ?, ?, ?)',
          [uuidv4(), notificationId, user.id, 'failed', err.message]
        );
      }
    }

    const overallStatus = sent > 0 && failed === 0 ? 'sent'
      : failed > 0 && sent === 0 ? 'failed' : 'partial';

    run('UPDATE notifications SET status = ? WHERE id = ?', [overallStatus, notificationId]);

    res.json({
      notification_id: notificationId,
      status: overallStatus,
      sent,
      failed,
      total: subscribers.length,
    });
  } catch (err) {
    console.error('POST /api/v1/notify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
