const { test } = require('node:test');
const assert = require('node:assert');
const { sniffMime } = require('../../src/services/logo');

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const webp = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]);

test('sniffMime detects PNG', () => {
  assert.strictEqual(sniffMime(png), 'image/png');
});

test('sniffMime detects JPEG', () => {
  assert.strictEqual(sniffMime(jpeg), 'image/jpeg');
});

test('sniffMime detects WebP (RIFF+WEBP at offset 8)', () => {
  assert.strictEqual(sniffMime(webp), 'image/webp');
});

test('sniffMime returns null for unknown content', () => {
  assert.strictEqual(sniffMime(garbage), null);
});

test('sniffMime returns null for too-short buffers', () => {
  assert.strictEqual(sniffMime(Buffer.from([0x89])), null);
});

test('sniffMime does not accept RIFF-only file (no WEBP marker)', () => {
  const riffOnly = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  assert.strictEqual(sniffMime(riffOnly), null);
});
