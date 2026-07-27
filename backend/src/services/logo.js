const path = require('path');
const fs = require('fs');
const config = require('../config');

const logosDir = path.resolve(config.upload.dir, 'logos');

if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

const ALLOWED_MIME = config.upload.allowedMime;
const MAX_SIZE = config.upload.maxFileSize;

function validate(file) {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    throw new Error(`Invalid mime type: ${file.mimetype}. Allowed: ${ALLOWED_MIME.join(', ')}`);
  }
  if (file.size > MAX_SIZE) {
    throw new Error(`File too large. Max: ${MAX_SIZE} bytes`);
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

module.exports = { save, delete: deleteLogo, logosDir };
