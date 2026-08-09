const { test } = require('node:test');
const assert = require('node:assert');
const config = require('../../src/config');

test('config exposes expected sections', () => {
  assert.strictEqual(typeof config.port, 'number');
  assert.strictEqual(typeof config.nodeEnv, 'string');
  assert.strictEqual(typeof config.baseUrl, 'string');
  assert.ok(config.db && typeof config.db.client === 'string');
  assert.ok(config.vapid && typeof config.vapid.subject === 'string');
  assert.ok(config.upload && Array.isArray(config.upload.allowedMime));
  assert.ok(config.admin && typeof config.admin.username === 'string');
  assert.ok(config.jwt && typeof config.jwt.expiresIn === 'string');
});

test('upload allowed mime types are image formats', () => {
  assert.deepStrictEqual(
    config.upload.allowedMime.sort(),
    ['image/jpeg', 'image/png', 'image/webp'].sort()
  );
});

test('corsOrigins is null or an array of strings', () => {
  if (config.corsOrigins !== null) {
    assert.ok(Array.isArray(config.corsOrigins));
    for (const origin of config.corsOrigins) {
      assert.strictEqual(typeof origin, 'string');
    }
  }
});

test('jwt expiresIn is a non-empty string', () => {
  assert.ok(config.jwt.expiresIn.length > 0);
});
