const fs = require('fs');
const path = require('path');
const { run, queryAll } = require('../db');

async function runMigrations() {
  run(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    run_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const ran = new Set();
  const rows = queryAll('SELECT name FROM _migrations');
  for (const row of rows) ran.add(row.name);

  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (ran.has(file)) {
      console.log(`SKIP  ${file}`);
      continue;
    }

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

    run('INSERT INTO _migrations (name) VALUES (?)', [file]);
    console.log(`DONE  ${file}`);
  }

  return files.length;
}

module.exports = { runMigrations };
