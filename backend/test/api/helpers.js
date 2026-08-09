const { initDb, closeDb } = require('../../src/db');
const { runMigrations } = require('../../src/services/migrator');
const { createApp } = require('../../src/server');
const config = require('../../src/config');

async function boot(overrides = {}) {
  config.admin.password = overrides.adminPassword || 'admin123';
  config.jwt.secret = overrides.jwtSecret || 'test-secret-0123456789abcdef';

  await initDb({ inMemory: true });
  await runMigrations();

  const app = createApp();
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));

  const base = `http://127.0.0.1:${server.address().port}`;

  async function api(path, opts = {}) {
    const url = path.startsWith('http') ? path : base + '/api/v1' + path;
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    });
    let body = null;
    try { body = await res.json(); } catch { /* no body */ }
    return { status: res.status, body, headers: res.headers };
  }

  async function adminLogin() {
    const r = await api('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ username: config.admin.username, password: config.admin.password }),
    });
    return { token: r.body.token, api };
  }

  return { api, adminLogin, base, close: async () => { server.close(); closeDb(); } };
}

module.exports = { boot };
