require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();

// Compressed photos are data URLs (base64 JPEG, ~<1MB typically); 15mb leaves headroom.
app.use(express.json({ limit: '15mb' }));

app.get('/api/storage/:key', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT value FROM kv_store WHERE key = $1', [req.params.key]);
    if (!rows.length) return res.json(null);
    res.json({ value: rows[0].value });
  } catch (err) {
    console.error('storage read failed:', err);
    res.status(500).json({ error: 'storage_read_failed' });
  }
});

app.put('/api/storage/:key', async (req, res) => {
  const { value } = req.body;
  if (typeof value !== 'string') return res.status(400).json({ error: 'value_must_be_string' });
  try {
    await pool.query(
      `INSERT INTO kv_store (key, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [req.params.key, value]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('storage write failed:', err);
    res.status(500).json({ error: 'storage_write_failed' });
  }
});

app.delete('/api/storage/:key', async (req, res) => {
  try {
    await pool.query('DELETE FROM kv_store WHERE key = $1', [req.params.key]);
    res.json({ ok: true });
  } catch (err) {
    console.error('storage delete failed:', err);
    res.status(500).json({ error: 'storage_delete_failed' });
  }
});

app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Ranger fleet server listening on :${port}`));
