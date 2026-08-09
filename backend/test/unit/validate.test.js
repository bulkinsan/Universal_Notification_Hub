const { test } = require('node:test');
const assert = require('node:assert');
const {
  validateCreateSource,
  validateSourceInput,
  validateSubscribe,
  validateUnsubscribe,
  validateNotify,
  validateLogin,
  validateId,
} = require('../../src/services/validate');

test('validateCreateSource accepts valid input', () => {
  const r = validateCreateSource({ name: 'Bank', domain: 'bank.example.com' });
  assert.strictEqual(r.ok, true);
});

test('validateCreateSource rejects missing fields', () => {
  assert.strictEqual(validateCreateSource({}).ok, false);
  assert.strictEqual(validateCreateSource({ name: 'x' }).ok, false);
  assert.strictEqual(validateCreateSource({ domain: 'x.com' }).ok, false);
});

test('validateCreateSource rejects too-long name', () => {
  const r = validateCreateSource({ name: 'a'.repeat(101), domain: 'x.com' });
  assert.strictEqual(r.ok, false);
});

test('validateCreateSource rejects empty strings', () => {
  assert.strictEqual(validateCreateSource({ name: '', domain: 'x.com' }).ok, false);
});

test('validateSourceInput accepts partial update', () => {
  assert.strictEqual(validateSourceInput({ name: 'New' }).ok, true);
  assert.strictEqual(validateSourceInput({}).ok, true);
});

test('validateSourceInput rejects non-string field', () => {
  assert.strictEqual(validateSourceInput({ name: 123 }).ok, false);
});

test('validateSubscribe accepts valid pwa subscription', () => {
  const r = validateSubscribe({ source_id: 'id-1', device_type: 'pwa', push_subscription: { endpoint: 'x' } });
  assert.strictEqual(r.ok, true);
});

test('validateSubscribe rejects bad device_type', () => {
  assert.strictEqual(validateSubscribe({ source_id: 'id-1', device_type: 'carrier_pigeon' }).ok, false);
});

test('validateSubscribe rejects missing source_id', () => {
  assert.strictEqual(validateSubscribe({ device_type: 'pwa' }).ok, false);
});

test('validateUnsubscribe requires user_id and source_id', () => {
  assert.strictEqual(validateUnsubscribe({ user_id: 'u', source_id: 's' }).ok, true);
  assert.strictEqual(validateUnsubscribe({ source_id: 's' }).ok, false);
  assert.strictEqual(validateUnsubscribe({ user_id: 'u' }).ok, false);
});

test('validateNotify requires title', () => {
  assert.strictEqual(validateNotify({}).ok, false);
  assert.strictEqual(validateNotify({ title: 'Hi' }).ok, true);
});

test('validateNotify rejects oversized title', () => {
  assert.strictEqual(validateNotify({ title: 'a'.repeat(256) }).ok, false);
});

test('validateNotify accepts JSON object data', () => {
  assert.strictEqual(validateNotify({ title: 'Hi', data: { deep_link: 'x' } }).ok, true);
});

test('validateNotify rejects non-object data', () => {
  assert.strictEqual(validateNotify({ title: 'Hi', data: 'string' }).ok, false);
  assert.strictEqual(validateNotify({ title: 'Hi', data: [1, 2] }).ok, false);
});

test('validateLogin requires username and password', () => {
  assert.strictEqual(validateLogin({ username: 'a', password: 'b' }).ok, true);
  assert.strictEqual(validateLogin({ username: 'a' }).ok, false);
  assert.strictEqual(validateLogin({}).ok, false);
});

test('validateId accepts UUIDs and rejects junk', () => {
  assert.strictEqual(validateId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), true);
  assert.strictEqual(validateId('short'), false);
  assert.strictEqual(validateId(''), false);
  assert.strictEqual(validateId('a'.repeat(100)), false);
});
