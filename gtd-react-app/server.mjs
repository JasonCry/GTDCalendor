#!/usr/bin/env node
/**
 * GTD Flow sync server: serves the built app and exposes GET/POST /api/markdown
 * so that multiple devices (e.g. MacBook + phone on LAN) share the same task list.
 * Run after build: npm run build && node server.mjs
 */
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;
const STORE_PATH = join(__dirname, 'data', 'store.json');

app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'dist'), {
  maxAge: '1h',
  etag: true,
  lastModified: true,
}));

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { markdown: '' };
  }
}

function writeStore(data) {
  const dir = dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 0), 'utf8');
}

app.get('/api/markdown', (req, res) => {
  const { markdown } = readStore();
  res.set('Cache-Control', 'no-store');
  res.json({ markdown: markdown || '' });
});

app.post('/api/markdown', (req, res) => {
  const { markdown } = req.body || {};
  if (typeof markdown !== 'string') {
    return res.status(400).json({ error: 'markdown required' });
  }
  writeStore({ markdown });
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`GTD Flow sync server: http://0.0.0.0:${PORT}`);
  console.log(`  LAN: use this machine's IP and port ${PORT} from other devices.`);
});
