const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const config = require('./config');

let database = null;
let filename = null;
let inMemory = false;

async function initDb(options = {}) {
  const SQL = await initSqlJs();

  inMemory = Boolean(options.inMemory);
  filename = options.filename ? path.resolve(options.filename) : null;

  if (inMemory || !filename) {
    database = new SQL.Database();
    return database;
  }

  const dir = path.dirname(filename);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(filename)) {
    const buffer = fs.readFileSync(filename);
    database = new SQL.Database(buffer);
  } else {
    database = new SQL.Database();
  }

  return database;
}

function flush() {
  if (!database || !filename || inMemory) return;
  const data = database.export();
  fs.writeFileSync(filename, Buffer.from(data));
}

function getDb() {
  if (!database) throw new Error('Database not initialized');
  return database;
}

function closeDb() {
  if (database) {
    flush();
    database.close();
    database = null;
  }
}

function queryAll(sql, params = []) {
  const results = database.exec(sql, params);
  if (!results.length || !results[0].values) return [];
  const cols = results[0].columns;
  return results[0].values.map((vals) => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = vals[i]; });
    return obj;
  });
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

function run(sql, params = []) {
  const result = database.run(sql, params);
  flush();
  return result;
}

module.exports = { initDb, getDb, closeDb, queryAll, queryOne, run };
