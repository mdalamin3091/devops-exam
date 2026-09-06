// Postgres connection + প্রতিটা query মাপার wrapper
const { Pool } = require('pg');
const { dbDuration, dbRows } = require('./metrics');

const pool = new Pool({
  host: process.env.PGHOST || 'postgres',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || 'notes',
  password: process.env.PGPASSWORD || 'notes',
  database: process.env.PGDATABASE || 'notesdb',
  max: 10
});

// name = metric-এ যে নামে দেখা যাবে. req দিলে ওই request-এর query count বাড়ে।
async function q(name, text, params = [], req = null) {
  const end = dbDuration.startTimer({ query_name: name });
  try {
    const r = await pool.query(text, params);
    dbRows.observe({ query_name: name }, r.rowCount || 0);
    if (req) req.dbQueryCount = (req.dbQueryCount || 0) + 1;
    return r;
  } finally {
    end();
  }
}

module.exports = { pool, q };
