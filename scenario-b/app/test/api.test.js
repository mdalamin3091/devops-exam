// 3টা সত্যিকারের test. DB ছাড়াই চলে, তাই CI দ্রুত হয়।
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/server');

test('GET /healthz -> 200 ok', async () => {
  const r = await request(app).get('/healthz');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.status, 500);
});

test('GET / -> app name আর version দেয়', async () => {
  const r = await request(app).get('/');
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.body.app, 'notes-api');
  assert.ok(r.body.version);
});

test('GET /metrics -> Prometheus format, আমাদের metric গুলো আছে', async () => {
  const r = await request(app).get('/metrics');
  assert.strictEqual(r.status, 200);
  assert.match(r.text, /http_requests_total/);
  assert.match(r.text, /db_queries_per_request/);
});

test('নাই এমন route -> 404', async () => {
  const r = await request(app).get('/nai-emon-kichu');
  assert.strictEqual(r.status, 404);
});
