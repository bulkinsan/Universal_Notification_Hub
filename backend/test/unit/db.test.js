const { test, before, after } = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const config = require('../../src/config');
const db = require('../../src/db');

let tmpFile;

before(async () => {
  tmpFile = path.join(os.tmpdir(), `hub-db-test-${process.pid}.sqlite`);
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  config.db.sqliteFilename = tmpFile;
  await db.initDb();
});

after(() => {
  db.closeDb();
  if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
});

test('initDb() without arguments persists to the configured file', () => {
  db.run('CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY, v TEXT)');
  db.run('INSERT INTO probe (v) VALUES (?)', ['hello']);
  assert.ok(fs.existsSync(tmpFile), 'database file was not created on disk');
  assert.ok(fs.statSync(tmpFile).size > 0, 'database file is empty');
});

test('data written earlier is readable after a reopen', async () => {
  const sizeBefore = fs.statSync(tmpFile).size;
  db.closeDb();
  await db.initDb();
  const rows = db.queryAll('SELECT v FROM probe');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].v, 'hello');
  assert.ok(fs.statSync(tmpFile).size >= sizeBefore - 4096);
});

test('inMemory mode never touches the filesystem', async () => {
  const probe = path.join(os.tmpdir(), `hub-db-mem-${process.pid}.sqlite`);
  await db.initDb({ inMemory: true });
  db.run('CREATE TABLE IF NOT EXISTS mem (v TEXT)');
  db.run('INSERT INTO mem (v) VALUES (?)', ['x']);
  assert.ok(!fs.existsSync(probe), 'in-memory mode wrote to disk');
  assert.strictEqual(db.queryAll('SELECT v FROM mem').length, 1);
});