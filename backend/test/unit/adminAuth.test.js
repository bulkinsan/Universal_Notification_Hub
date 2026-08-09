const { test } = require('node:test');
const assert = require('node:assert');
const {
  issueToken,
  verifyToken,
  verifyAdminCredentials,
} = require('../../src/middleware/adminAuth');
const config = require('../../src/config');

test('issueToken + verifyToken round trip', () => {
  const token = issueToken('admin');
  const payload = verifyToken(token);
  assert.strictEqual(payload.sub, 'admin');
  assert.strictEqual(payload.role, 'admin');
});

test('verifyToken rejects invalid token', () => {
  assert.throws(() => verifyToken('not-a-token'));
});

test('verifyToken rejects token signed with wrong secret', () => {
  const jwt = require('jsonwebtoken');
  const forged = jwt.sign({ sub: 'admin', role: 'admin' }, 'wrong-secret-123', { expiresIn: '1h' });
  assert.throws(() => verifyToken(forged));
});

test('verifyAdminCredentials accepts configured credentials', () => {
  if (!config.admin.password) {
    // ADMIN_PASSWORD unset — login is disabled by design; just assert the contract.
    assert.strictEqual(verifyAdminCredentials('admin', 'x'), false);
    return;
  }
  assert.strictEqual(verifyAdminCredentials(config.admin.username, config.admin.password), true);
  assert.strictEqual(verifyAdminCredentials(config.admin.username, 'wrong'), false);
  assert.strictEqual(verifyAdminCredentials('someone', config.admin.password), false);
});
