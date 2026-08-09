const path = require('path');
const fs = require('fs');
const config = require('../config');

const logosDir = path.resolve(config.upload.dir, 'logos');

if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const ALLOWED_MIME = config.upload.allowedMime;
const MAX_SIZE = config.upload.maxFileSize;

class LogoValidationError extends Error {}

const MAGIC_BYTES = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 }],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },
    { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
  ],
};

function sniffMime(buffer) {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    const matched = signatures.every(({ bytes, offset }) =>
      buffer.length >= offset + bytes.length &&
      bytes.every((byte, i) => buffer[offset + i] === byte)
    );
    if (matched) return mime;
  }
  return null;
}

function validate(file) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    throw new LogoValidationError(`Invalid mime type: ${file.mimetype}. Allowed: ${ALLOWED_MIME.join(', ')}`);
  }
  if (file.size > MAX_SIZE) {
    throw new LogoValidationError(`File too large. Max: ${MAX_SIZE} bytes`);
  }
  const detected = sniffMime(file.buffer);
  if (!detected) {
    throw new LogoValidationError('File content does not match any allowed image format');
  }
  if (detected !== file.mimetype) {
    throw new LogoValidationError(`File signature (${detected}) does not match declared mime (${file.mimetype})`);
  }
}

function extFromMime(mime) {
  const map = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  return map[mime] || '.png';
}

async function save(sourceId, file) {
  validate(file);

  const ext = extFromMime(file.mimetype);
  const filename = `${sourceId}${ext}`;
  const filepath = path.join(logosDir, filename);

  fs.writeFileSync(filepath, file.buffer);

  return path.join('logos', filename);
}

function deleteLogo(logoPath) {
  if (!logoPath) return;
  const fullPath = path.resolve(config.upload.dir, logoPath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

module.exports = { save, delete: deleteLogo, logosDir, sniffMime, LogoValidationError };
