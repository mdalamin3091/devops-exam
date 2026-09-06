// Prometheus metrics. সব metric এখানে এক জায়গায়।
const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// কতগুলো request এসেছে
const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'total http requests',
  labelNames: ['route', 'method', 'status', 'tenant'],
  registers: [register]
});

// request কত সময় নিল (p95 এখান থেকে বের হয়)
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'http request duration',
  labelNames: ['route', 'method', 'tenant'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register]
});

// কোন query ধীর
const dbDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'db query duration',
  labelNames: ['query_name'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register]
});

// ⭐ এইটা দিয়ে N+1 ধরা পড়ে: এক request-এ কয়টা query হলো
const dbQueriesPerRequest = new client.Histogram({
  name: 'db_queries_per_request',
  help: 'how many db queries one request made',
  labelNames: ['route'],
  buckets: [1, 2, 3, 5, 10, 21, 25, 50, 100, 250],
  registers: [register]
});

// এক query কয়টা row ফেরত দিল (limit=5000 এখানে ধরা পড়ে)
const dbRows = new client.Histogram({
  name: 'db_rows_returned',
  help: 'rows returned per query',
  labelNames: ['query_name'],
  buckets: [1, 10, 20, 50, 100, 500, 1000, 5000, 20000, 50000],
  registers: [register]
});

// এই মুহূর্তে কয়টা request চলছে
const inFlight = new client.Gauge({
  name: 'http_requests_in_flight',
  help: 'requests being processed right now',
  registers: [register]
});

module.exports = {
  register, httpRequests, httpDuration, dbDuration,
  dbQueriesPerRequest, dbRows, inFlight
};
