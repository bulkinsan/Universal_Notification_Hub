const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { hashApiKey } = require('../../src/middleware/auth');

test('hashApiKey returns a sha256 hex digest of the key', () => {
  const key = 'sk_test_key_123';
  const expected = crypto.createHash('sha256').update(key).digest('hex');
  assert.strictEqual(hashApiKey(key), expected);
});

test('hashApiKey is deterministic', () => {
  const key = 'sk_same_key';
  assert.strictEqual(hashApiKey(key), hashApiKey(key));
});

test('hashApiKey does not store the raw key', () => {
  const key = 'sk_secret_abc';
  const hash = hashApiKey(key);
  assert.notStrictEqual(hash, key);
  assert.ok(!hash.includes('sk_'));
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test('different keys produce different hashes', () => {
  assert.notStrictEqual(hashApiKey('sk_a'), hashApiKey('sk_b'));
});
