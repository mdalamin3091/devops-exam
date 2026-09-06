// 5 tenant, 50,000 note, 150,000 tag — এক এক করে না, একবারে বানায় (তাই দ্রুত)
const { pool } = require('./db');

const SQL = `
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES tenants(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  note_id INT NOT NULL REFERENCES notes(id),
  name TEXT NOT NULL
);
-- ⚠️ tags.note_id এ ইচ্ছা করে index দিচ্ছি না (সমস্যা 3)
`;

async function main() {
  await pool.query(SQL);

  await pool.query(`INSERT INTO tenants (slug)
    VALUES ('acme'),('globex'),('initech'),('umbrella'),('hooli')
    ON CONFLICT (slug) DO NOTHING`);

  const c = await pool.query('SELECT count(*)::int AS n FROM notes');
  if (c.rows[0].n > 1000) { console.log('already seeded:', c.rows[0].n); await pool.end(); return; }

  console.log('seeding 50000 notes ...');
  // tenant 1 (acme) পাবে 30000, বাকি ৪ জন 5000 করে -> ইচ্ছা করে অসমান
  await pool.query(`
    INSERT INTO notes (tenant_id,title,body)
    SELECT 1, 'Note ' || g, md5(random()::text) || ' abc ' || md5(random()::text)
    FROM generate_series(1,30000) g`);
  await pool.query(`
    INSERT INTO notes (tenant_id,title,body)
    SELECT (g % 4) + 2, 'Note ' || g, md5(random()::text) || ' abc ' || md5(random()::text)
    FROM generate_series(1,20000) g`);

  console.log('seeding 150000 tags ...');
  await pool.query(`
    INSERT INTO tags (note_id,name)
    SELECT (random()*49999+1)::int, 'tag' || (random()*20)::int
    FROM generate_series(1,150000)`);

  const s = await pool.query(`SELECT
      (SELECT count(*) FROM tenants) tenants,
      (SELECT count(*) FROM notes) notes,
      (SELECT count(*) FROM tags) tags`);
  console.log(s.rows[0]);
  await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
