const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const { randomToken } = require('./utils/security');

const config = require('./config');
const { initDb, closeDb } = require('./db');
const { runMigrations } = require('./services/migrator');

const sourcesRouter = require('./routes/sources');
const subscribeRouter = require('./routes/subscribe');
const notifyRouter = require('./routes/notify');
const notificationsRouter = require('./routes/notifications');
const adminRouter = require('./routes/admin');

function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());

  if (config.corsOrigins && config.corsOrigins.length) {
    app.use(cors({ origin: config.corsOrigins }));
  } else {
    if (config.nodeEnv === 'production') {
      console.warn('[security] CORS_ORIGINS is not set in production — allowing all origins. Set CORS_ORIGINS to restrict.');
    }
    app.use(cors());
  }

  app.use(express.json({ limit: '1mb' }));

  app.use('/uploads', express.static(path.resolve(config.upload.dir)));

  app.use('/api/v1/sources', sourcesRouter);
  app.use('/api/v1/subscribe', subscribeRouter);
  app.use('/api/v1/notify', notifyRouter);
  app.use('/api/v1/notifications', notificationsRouter);
  app.use('/api/v1/admin', adminRouter);

  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/vapid-public-key', (req, res) => {
    res.json({ publicKey: config.vapid.publicKey || '' });
  });

  app.use('/pwa', express.static(path.join(__dirname, '..', '..', 'pwa')));
  app.use('/admin', express.static(path.join(__dirname, '..', '..', 'admin')));

  app.get('/', (req, res) => {
    res.redirect('/admin');
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

async function main() {
  await initDb();
  await runMigrations();
  console.log('Database initialized');

  if (!config.admin.password) {
    if (config.nodeEnv === 'production') {
      console.error('[security] ADMIN_PASSWORD is required in production. Set ADMIN_PASSWORD in .env.');
      process.exit(1);
    }
    config.admin.password = randomToken(12);
    console.warn(`[security] ADMIN_PASSWORD is not set. Generated temporary dev password: ${config.admin.password}`);
    console.warn('[security] Set ADMIN_PASSWORD in .env to disable this warning.');
  }

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`Notification Hub running on http://localhost:${config.port}`);
  });

  const shutdown = () => {
    console.log('\nShutting down...');
    server.close(() => {
      closeDb();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { createApp, main };
