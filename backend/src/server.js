const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const config = require('./config');
const { initDb, run, queryAll } = require('./db');

const sourcesRouter = require('./routes/sources');
const subscribeRouter = require('./routes/subscribe');
const notifyRouter = require('./routes/notify');

async function runMigrations() {
  run(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    run_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const ran = new Set();
  const rows = queryAll('SELECT name FROM _migrations');
  for (const row of rows) ran.add(row.name);

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (ran.has(file)) { console.log(`SKIP  ${file}`); continue; }

    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const lines = raw.split('\n').filter((l) => !l.trim().startsWith('--') && l.trim() !== '');
    const sql = lines.join('\n');

    const statements = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 3);

    for (const stmt of statements) {
      if (stmt.toUpperCase().startsWith('CREATE INDEX')) {
        try { run(stmt); } catch (e) { /* may exist */ }
      } else {
        run(stmt);
      }
    }

    run("INSERT INTO _migrations (name) VALUES (?)", [file]);
    console.log(`DONE  ${file}`);
  }
}

async function main() {
  await initDb();
  await runMigrations();
  console.log('Database initialized');

  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/uploads', express.static(path.resolve(config.upload.dir)));

  app.use('/api/v1/sources', sourcesRouter);
  app.use('/api/v1/subscribe', subscribeRouter);
  app.use('/api/v1/notify', notifyRouter);

  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/v1/vapid-public-key', (req, res) => {
    res.json({ publicKey: config.vapid.publicKey || '' });
  });

  app.use('/pwa', express.static(path.join(__dirname, '..', '..', 'pwa')));

  app.get('/', (req, res) => {
    res.redirect('/pwa');
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(config.port, () => {
    console.log(`Notification Hub running on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
