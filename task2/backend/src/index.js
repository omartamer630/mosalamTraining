const express = require('express');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

console.log('[STARTUP] CORS origin:', CORS_ORIGIN);

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'taskflow',
  max: 10,
  connectionTimeoutMillis: 5000,
});

console.log('[STARTUP] DB config:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
});

const app = express();
app.use(express.json());

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

let dbConnected = false;

const retryDelay = (attempt) => Math.min(1000 * 2 ** attempt, 30000);

async function waitForDb() {
  for (let attempt = 1; ; attempt++) {
    try {
      console.log(`[DB] Connection attempt ${attempt}...`);
      await pool.query('SELECT 1');
      dbConnected = true;
      console.log('[DB] Connected successfully');
      return;
    } catch (err) {
      dbConnected = false;
      console.log(`[DB] Attempt ${attempt} failed: ${err.message}`);
      const delay = retryDelay(attempt - 1);
      console.log(`[DB] Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

async function initTables() {
  const client = await pool.connect();
  try {
    console.log('[DB] Checking/creating tasks table...');
    const result = await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    if (result.command === 'CREATE') {
      console.log('[DB] Tasks table created');
    } else {
      console.log('[DB] Tasks table already exists, skipped');
    }
  } catch (err) {
    console.error('[DB] Failed to initialize tables:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

app.get('/api/health', async (_req, res) => {
  if (!dbConnected) {
    return res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'healthy', database: 'connected' });
  } catch {
    return res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

app.get('/api/tasks', async (_req, res) => {
  console.log('[API] GET /api/tasks');
  const result = await pool.query('SELECT * FROM tasks ORDER BY created_at DESC');
  console.log(`[API] GET /api/tasks -> ${result.rows.length} tasks`);
  res.json(result.rows);
});

app.post('/api/tasks', async (req, res) => {
  const { title } = req.body;
  console.log('[API] POST /api/tasks -> title:', title);
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    console.log('[API] POST /api/tasks -> 400 invalid title');
    return res.status(400).json({ error: 'title is required' });
  }
  const result = await pool.query(
    'INSERT INTO tasks (title, status) VALUES ($1, $2) RETURNING *',
    [title.trim(), 'pending']
  );
  console.log(`[API] POST /api/tasks -> 201 task #${result.rows[0].id} created`);
  res.status(201).json(result.rows[0]);
});

app.patch('/api/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  console.log(`[API] PATCH /api/tasks/${id}`);
  if (isNaN(id)) {
    console.log(`[API] PATCH /api/tasks/${id} -> 400 invalid id`);
    return res.status(400).json({ error: 'invalid id' });
  }

  const result = await pool.query(
    `UPDATE tasks SET status = CASE WHEN status = 'pending' THEN 'done' ELSE 'pending' END WHERE id = $1 RETURNING *`,
    [id]
  );
  if (result.rows.length === 0) {
    console.log(`[API] PATCH /api/tasks/${id} -> 404 not found`);
    return res.status(404).json({ error: 'task not found' });
  }
  console.log(`[API] PATCH /api/tasks/${id} -> ${result.rows[0].status}`);
  res.json(result.rows[0]);
});

app.delete('/api/tasks/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  console.log(`[API] DELETE /api/tasks/${id}`);
  if (isNaN(id)) {
    console.log(`[API] DELETE /api/tasks/${id} -> 400 invalid id`);
    return res.status(400).json({ error: 'invalid id' });
  }

  const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING *', [id]);
  if (result.rows.length === 0) {
    console.log(`[API] DELETE /api/tasks/${id} -> 404 not found`);
    return res.status(404).json({ error: 'task not found' });
  }
  console.log(`[API] DELETE /api/tasks/${id} -> task deleted, title was "${result.rows[0].title}"`);
  res.json(result.rows[0]);
});

app.get('/api/error-test', (_req, res) => {
  throw new Error('Deliberate error for testing error monitoring');
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await waitForDb();
  await initTables();
  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
}

start();
