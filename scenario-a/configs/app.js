// Scenario A app - খালি Node দিয়ে, কোনো npm package লাগে না
const http = require('http');
const os   = require('os');

const PORT = process.env.PORT || 3000;
const NAME = process.env.APP_NAME || ('backend-' + PORT);
let hung = false;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // /hang হিট করার পর app বেঁচে থাকে কিন্তু কোনো উত্তর দেয় না
  if (hung && url !== '/hang') { return; }

  if (url === '/') {
    res.setHeader('X-Served-By', os.hostname());
    return res.end(`Hello from ${NAME} on port ${PORT} host ${os.hostname()}\n`);
  }
  if (url === '/healthz') { res.statusCode = 200; return res.end('ok\n'); }

  if (url === '/whoami') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      remoteAddress: req.socket.remoteAddress,
      headers: req.headers
    }, null, 2));
  }
  if (url === '/api/notes') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify([{ id: 1, title: 'note' }]));
  }
  if (url === '/slow') {                       // 45 সেকেন্ড পরে উত্তর
    return setTimeout(() => res.end('finally\n'), 45000);
  }
  if (url === '/crash') {                      // process মরে যাবে
    res.end('bye\n');
    return setTimeout(() => process.exit(1), 100);
  }
  if (url === '/hang') {                       // বেঁচে আছে, কিন্তু জবাব নাই
    res.end('now hanging\n');
    hung = true;
    return;
  }
  res.statusCode = 404; res.end('not found\n');
});

server.listen(PORT, '0.0.0.0', () =>
  console.log(`${NAME} listening on ${PORT}`));
