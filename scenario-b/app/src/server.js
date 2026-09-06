// Multi-tenant Notes API
// ⚠️ এখানে ৪টা সমস্যা ইচ্ছা করে রাখা আছে (B3-তে monitoring দিয়ে ধরব):
//   1. GET /api/notes -> N+1 query
//   2. GET /api/search -> index ছাড়া LIKE
//   3. tags.note_id এ index নাই
//   4. ?limit=50000 দিলেও ঠেকানো হয় না
const express = require('express');
const os = require('os');
const { q, pool } = require('./db');
const M = require('./metrics');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
// Task 28d: BIND_HOST=127.0.0.1 দিলে container-এর বাইরে থেকে connection refused হবে
const HOST = process.env.BIND_HOST || '0.0.0.0';
const VERSION = process.env.APP_VERSION || 'v1';
const BROKEN = process.env.BROKEN === '1';   // v3 ইচ্ছা করে ভাঙা image-এর জন্য

// ---------- metrics middleware ----------
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  req.dbQueryCount = 0;                       // ⭐ প্রতি request-এর নিজের গণনা
  M.inFlight.inc();

  res.on('finish', () => {
    M.inFlight.dec();
    // ⚠️ আসল URL না, route pattern ব্যবহার করছি (/api/notes/:id)।
    // /api/notes/48213 লিখলে ৫০ হাজার series হয়ে Prometheus মরে যেত (high cardinality)।
    const route = (req.route && req.route.path) ? req.route.path : 'unknown';
    const tenant = req.headers['x-tenant'] || 'none';
    const sec = Number(process.hrtime.bigint() - start) / 1e9;

    M.httpRequests.inc({ route, method: req.method, status: res.statusCode, tenant });
    M.httpDuration.observe({ route, method: req.method, tenant }, sec);
    M.dbQueriesPerRequest.observe({ route }, req.dbQueryCount);
  });
  next();
});

// ---------- tenant ----------
const tenantCache = new Map();
async function tenantId(req) {
  const slug = req.headers['x-tenant'] || 'acme';
  if (tenantCache.has(slug)) return tenantCache.get(slug);
  const r = await q('tenant_lookup', 'SELECT id FROM tenants WHERE slug=$1', [slug], req);
  if (!r.rows[0]) return null;
  tenantCache.set(slug, r.rows[0].id);
  return r.rows[0].id;
}

// ---------- basic ----------
app.get('/', (req, res) => {
  res.setHeader('X-Served-By', os.hostname());
  res.json({ app: 'notes-api', version: VERSION, host: os.hostname(), port: PORT });
});

app.get('/healthz', (req, res) => {
  res.setHeader('X-Served-By', os.hostname());
  if (BROKEN) return res.status(500).send('broken build');   // Task 38
  res.status(200).send('ok');
});

// readyz -> DB সত্যিই কাজ করছে কিনা
app.get('/readyz', async (req, res) => {
  try {
    await q('readyz', 'SELECT 1', [], req);
    res.status(200).send('ready');
  } catch (e) {
    res.status(503).send('db not ready: ' + e.message);
  }
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', M.register.contentType);
  res.end(await M.register.metrics());
});

// ---------- notes ----------
app.post('/api/notes', async (req, res) => {
  const t = await tenantId(req);
  if (!t) return res.status(400).json({ error: 'unknown tenant' });
  const { title = 'untitled', body = '' } = req.body || {};
  const r = await q('insert_note',
    'INSERT INTO notes (tenant_id,title,body) VALUES ($1,$2,$3) RETURNING *',
    [t, title, body], req);
  res.status(201).json(r.rows[0]);
});

// ❌ সমস্যা 1 (N+1) আর সমস্যা 4 (limit-এ কোনো সীমা নাই) — ইচ্ছা করে রাখা
app.get('/api/notes', async (req, res) => {
  const t = await tenantId(req);
  if (!t) return res.status(400).json({ error: 'unknown tenant' });
  const limit = parseInt(req.query.limit || '20', 10);      // কোনো max নাই
  const page = parseInt(req.query.page || '1', 10);
  const offset = (page - 1) * limit;

  const notes = await q('list_notes',
    'SELECT * FROM notes WHERE tenant_id=$1 ORDER BY id LIMIT $2 OFFSET $3',
    [t, limit, offset], req);                                // ১টা query

  for (const n of notes.rows) {                              // তারপর আরও N টা query
    const tags = await q('tags_for_note',
      'SELECT name FROM tags WHERE note_id=$1', [n.id], req);
    n.tags = tags.rows.map(x => x.name);
  }
  res.json(notes.rows);
});

app.get('/api/notes/:id', async (req, res) => {
  const t = await tenantId(req);
  const r = await q('get_note',
    'SELECT * FROM notes WHERE id=$1 AND tenant_id=$2', [req.params.id, t], req);
  if (!r.rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(r.rows[0]);
});

// ❌ সমস্যা 2 — body তে index নাই, তাই পুরো table পড়তে হয়
app.get('/api/search', async (req, res) => {
  const t = await tenantId(req);
  const term = req.query.q || '';
  const r = await q('search_notes',
    "SELECT id,title FROM notes WHERE tenant_id=$1 AND body LIKE '%' || $2 || '%' LIMIT 50",
    [t, term], req);
  res.json(r.rows);
});

// ❌ সমস্যা 3 — tags.note_id এ index নাই, তাই এই join ধীর
app.get('/api/stats', async (req, res) => {
  const r = await q('stats',
    `SELECT te.slug, COUNT(DISTINCT n.id) AS notes, COUNT(tg.id) AS tags
     FROM tenants te
     LEFT JOIN notes n ON n.tenant_id = te.id
     LEFT JOIN tags tg ON tg.note_id = n.id
     GROUP BY te.slug ORDER BY te.slug`, [], req);
  res.json(r.rows);
});

if (require.main === module) {
  // ⭐ শুরুতেই DB চেক করি। DB রেডি না হলে app মরে যাবে।
  // এই জন্যই compose-এ শুধু depends_on যথেষ্ট না (Task 26)।
  pool.query('SELECT 1')
    .then(() => app.listen(PORT, HOST, () =>
      console.log(`notes-api ${VERSION} listening on ${HOST}:${PORT} host=${os.hostname()}`)))
    .catch(e => {
      console.error('DB connect failed at startup:', e.message);
      process.exit(1);
    });
}
module.exports = app;
