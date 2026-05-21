import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, 'data.json');
const PORT = 3001;

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/data', (_req, res) => {
  if (!existsSync(DATA_FILE)) return res.json(null);
  try {
    res.json(JSON.parse(readFileSync(DATA_FILE, 'utf-8')));
  } catch {
    res.status(500).json({ error: 'Failed to read data file' });
  }
});

app.post('/api/data', (req, res) => {
  try {
    writeFileSync(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`[storage] Data file: ${DATA_FILE}`);
  console.log(`[storage] Server running on http://localhost:${PORT}`);
});
