const { test } = require('node:test');
const assert = require('node:assert');
const { timingSafeEqualString, generateApiKey, sha256 } = require('../../src/utils/security');

test('timingSafeEqualString matches equal strings', () => {
  assert.strictEqual(timingSafeEqualString('abc', 'abc'), true);
});

test('timingSafeEqualString rejects different strings', () => {
  assert.strictEqual(timingSafeEqualString('abc', 'abd'), false);
});

test('timingSafeEqualString handles length mismatch without throwing', () => {
  assert.strictEqual(timingSafeEqualString('abc', 'abcdef'), false);
});

test('generateApiKey has sk_ prefix and 64 hex chars', () => {
  const key = generateApiKey();
  assert.match(key, /^sk_[0-9a-f]{64}$/);
});

test('generateApiKey produces unique keys', () => {
  assert.notStrictEqual(generateApiKey(), generateApiKey());
});

test('sha256 returns 64 hex chars', () => {
  assert.match(sha256('value'), /^[0-9a-f]{64}$/);
});
