require('dotenv').config();

const path = require('path');
const rootDir = path.resolve(__dirname, '..');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  db: {
    client: process.env.DB_CLIENT || 'sqlite3',
    sqliteFilename: path.resolve(rootDir, process.env.DB_FILENAME || './data/hub.sqlite'),
    pg: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || 'hub',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    },
  },
  vapid: {
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@hub.local',
    publicKey: process.env.VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
  },
  upload: {
    dir: path.resolve(rootDir, process.env.UPLOAD_DIR || './uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 1048576,
    allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
  },
};

module.exports = config;
