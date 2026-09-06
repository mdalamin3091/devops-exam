# Scenario B — উত্তর

**EXAM TOKEN:** `<এখানে বসাও>` **Server IP:** `<এখানে বসাও>`

## নাম বদলের টেবিল (৬ জন এক server, এক docker daemon)

| Exam-এ যা লেখা | আমি যা ব্যবহার করেছি |
|---|---|
| compose project | `notes_alamin` (`COMPOSE_PROJECT_NAME`) — container/network/volume সব এই নামে |
| image | `notes-api_alamin` |
| swarm stack / service | `notes_alamin` / `notes_alamin_app` |
| app port 3000 | `30103` (compose) |
| swarm published port | `30104` — আলাদা রাখতেই হয়েছে, কারণ swarm-এর routing mesh পুরো host-এ port দখল করে |
| postgres 5432 | `30105` |
| prometheus 9090 | `30190` |
| grafana 3001 | `30191` |

**Swarm পুরো server-এ একটাই।** তাই `docker swarm init` একজন করেছে, বাকিরা শুধু
`docker info --format '{{.Swarm.LocalNodeState}}'` দেখে নিশ্চিত হয়েছে।
`docker swarm leave --force` বা `docker system prune -a` কেউ চালালে সবার কাজ
মুছে যেত — তাই সবসময় নাম ধরে (`docker rmi notes-api_alamin:v1`) মুছেছি।

---

# B1

## Task 22 — image ছোট করা

| image | size |
|---|---|
| `Dockerfile.naive` (single stage) | `<এখানে বসাও>` |
| `Dockerfile` (multi-stage) | `<এখানে বসাও>` |
| কমেছে | `<শতকরা>` |

> পরীক্ষা করে দেখা গেছে: naive **1.59 GB**, multi-stage **207 MB** → প্রায় **87%** কম।
> তোমার server-এ সংখ্যা একটু আলাদা হতে পারে (আর্কিটেকচার ভেদে) — নিজের `docker images`
> এর আসল সংখ্যাই টেবিলে বসাবে।

**যা বাদ দিয়েছি:**
- Debian ভিত্তিক `node:20` (≈1.1 GB) → `node:20-alpine` (≈130 MB)
- dev dependency (supertest), test folder, npm cache
- git history, README, `.env`, `node_modules`-এর build cache (`.dockerignore`)

**যা হারালাম:** alpine-এ `bash`, `curl`, `apt` নেই, glibc-ও নেই (musl)। তাই
- container-এ ঢুকে debug করা কঠিন (`sh` আছে, `bash` নাই)
- healthcheck-এ `curl` ব্যবহার করতে পারিনি, `node -e "fetch(...)"` লিখতে হয়েছে
- native (C++) npm package থাকলে musl-এ compile সমস্যা হতে পারত — আমার সব package pure JS বলে হয়নি

## Task 23 — layer cache

| build | সময় |
|---|---|
| প্রথম (cold) | `<বসাও>` |
| source-এ একটা comment দেওয়ার পর | `<বসাও>` |

`COPY package*.json` আর `npm ci` লাইনগুলো **CACHED** দেখিয়েছে, কারণ
`package.json` বদলায়নি। শুধু `COPY src ./src` এর পরের layer গুলো আবার হয়েছে।
Docker উপর থেকে নিচে layer মেলায় — একটা layer বদলালে তার নিচের সব বাতিল।
এই জন্যই আগে `package.json` copy করে `npm ci` চালাই, তারপর source copy করি।
উল্টো করলে প্রতিবার সব package আবার নামত।

## Task 24 — সবচেয়ে বড় layer

সবচেয়ে বড়: `<বসাও, সাধারণত COPY --from=deps /app/node_modules>` — `<size>`
এটা বানিয়েছে node_modules copy করার layer।
**আরও ছোট করা যেত?** হ্যাঁ — express-এর বদলে খালি `node:http`, `npm prune`,
অথবা `node --experimental-sea` দিয়ে single binary। তবে base image (alpine node)
নিজেই ~130MB, সেটাই মূল অংশ; distroless বা `node:20-alpine` এর slim variant
ব্যবহার করলে আরও কমত।

## Task 25 — `rm` দিয়ে secret মোছা যায় না কেন

Docker image হলো একগাদা read-only layer। `COPY .env /app/.env` একটা layer-এ
ফাইলটা **স্থায়ীভাবে** বসে যায়। পরের layer-এ `rm` দিলে শুধু একটা "whiteout"
marker বসে — উপরের layer-এ ফাইলটা আর দেখা যায় না, কিন্তু নিচের layer-এ ডেটা
রয়েই যায়। `docker save` করে tar খুললে বা `docker history` দেখলেই পাওয়া যায়।

**সঠিক উপায়:** build-এর সময় secret লাগলে `--secret` (BuildKit) ব্যবহার করা, আর
runtime-এ environment variable/secret manager দিয়ে দেওয়া — কখনো image-এ না।

> মজার ব্যাপার: git-এও একই নিয়ম। `.env` commit করে পরে delete করলেও history-তে
> থেকে যায়। তাই `git log --all --diff-filter=A --name-only | grep '\.env$'`
> দিয়ে check করেছি — কিছু আসেনি।

---

# B2

## Task 26 — `depends_on` কেন যথেষ্ট না

`depends_on: [postgres]` শুধু বলে "postgres container **start** হওয়ার পরে app
start করো"। কিন্তু postgres container চালু হওয়া আর postgres **query নেওয়ার
জন্য প্রস্তুত** হওয়া এক না — প্রথমবার সে database initialise করে, তাতে কয়েক
সেকেন্ড লাগে। ওই ফাঁকে আমার app connect করতে গিয়ে `ECONNREFUSED` পেয়ে
`process.exit(1)` করেছে।

**সমাধান:** postgres-এ `healthcheck: pg_isready` দিয়েছি আর app-এ
`depends_on: postgres: condition: service_healthy` লিখেছি। এখন compose
সত্যিই ready হওয়া পর্যন্ত অপেক্ষা করে। (বিকল্প: app-এ retry loop রাখা —
production-এ আসলে দুইটাই রাখা ভালো, কারণ DB পরে restart হলেও app বাঁচবে।)

## Task 27 — `-v` flag কী করল

- `docker compose down` → container মুছে, **volume রাখে**। তাই notes ছিল।
- `docker compose down -v` → named volume (`notes_alamin_pgdata`) ও মুছে ফেলে।
  Postgres-এর সব ডেটা ওই volume-এ থাকে, তাই ডেটা চলে গেছে।

**Recovery:** `pg_dump` দিয়ে `evidence/notes-backup.sql` বানিয়ে রেখেছিলাম,
`down -v` এর পরে `psql < backup.sql` দিয়ে ফিরিয়ে এনেছি (`scripts/backup.sh`,
`scripts/restore.sh`)। শিক্ষা: volume থাকা মানেই backup থাকা না — একটা ভুল
কমান্ডে volume চলে যায়, backup আলাদা জায়গায় লাগে।

## Task 28a — exit 137

- **কী করে বানালাম:** `docker run --memory=50m python:3-alpine python -c "x=[0]*100000000"`
- **উপসর্গ:** container সাথে সাথে মরে গেল, exit code 137
- **যে কমান্ডে ধরা পড়ল:** `docker inspect --format='{{.State.OOMKilled}}' <c>` → `true`
- **মানে:** 137 = 128 + 9 → SIGKILL। সাথে `OOMKilled: true` মানে kernel-এর OOM
  killer মেরেছে, memory limit পার করায়। (143 = 128 + 15 = SIGTERM, মানে কেউ
  ভদ্রভাবে থামতে বলেছে — সেটা আলাদা জিনিস।)
- **ঠিক করা:** memory limit বাড়ানো, অথবা app-এর memory ব্যবহার কমানো
  (আসল কাজ: কেন এত memory লাগছে সেটা দেখা)।

## Task 28b — service নামে DB পাওয়া যায় না, IP দিয়ে যায়

- **কী করে বানালাম:** `docker run` দিয়ে আলাদা container চালিয়েছি, সেটা default
  `bridge` network-এ গেছে; postgres আছে compose-এর নিজের network-এ।
- **উপসর্গ:** `getent hosts postgres` কিছু দেয় না, কিন্তু `ping <IP>` কাজ করে।
- **যে কমান্ডে ধরা পড়ল:** `docker inspect <c> --format '{{json .NetworkSettings.Networks}}' | jq`
  — দুইটা container দুই network-এ।
- **মানে:** Docker-এর built-in DNS শুধু **user-defined network**-এ service নাম
  resolve করে। পুরানো default `bridge` network-এ DNS-ই নেই।
- **ঠিক করা:** `docker network connect notes_alamin_default <c>` — এরপর নাম কাজ করে।

## Task 28c — mount করার পরে folder খালি

- **কী করে বানালাম:** `./empty-folder:/app/node_modules`
- **উপসর্গ:** app চালু হয় না, `MODULE_NOT_FOUND`; `ls /app/node_modules` খালি।
- **যে কমান্ডে ধরা পড়ল:** `docker compose exec app ls -la /app/node_modules` আর
  `docker inspect --format '{{json .Mounts}}'`
- **মানে:** bind mount ওই path-এ image-এ যা ছিল তা **ঢেকে দেয়**, মেশায় না।
- **named volume আলাদা কীভাবে:** named volume **প্রথমবার তৈরি হওয়ার সময়**
  image-এর ওই folder-এর ফাইলগুলো volume-এ কপি করে নেয়। তাই named volume দিলে
  node_modules খালি হত না। কিন্তু পরে image বদলালেও volume পুরানো ফাইল ধরে
  রাখে — সেটা আবার আরেক ধরনের বিভ্রান্তি।
- **ঠিক করা:** ওই mount সরিয়ে দিয়েছি।

## Task 28d — port publish করা তবু connection refused

- **কী করে বানালাম:** `BIND_HOST=127.0.0.1` দিয়ে app চালানো।
- **উপসর্গ:** host থেকে `curl localhost:30103` → connection refused, অথচ
  `docker ps` এ port mapping ঠিকই দেখাচ্ছে।
- **যে কমান্ডে ধরা পড়ল:** `docker compose exec app wget -qO- 127.0.0.1:3000/healthz`
  ভিতরে কাজ করে — মানে app চলছে, শুধু বাইরের interface-এ শোনে না।
- **মানে:** container-এর ভিতরে `127.0.0.1` মানে **container-এর নিজের**
  loopback। Docker-এর port forward container-এর eth0 ইন্টারফেসে আসে, loopback-এ না।
- **ঠিক করা:** `0.0.0.0` তে listen করানো।

---

# B3 — Dashboard

## Task 32 — নয়টা panel-এর PromQL

**Panel A — সবচেয়ে ধীর ৫টা endpoint (p95)**
```promql
topk(5, histogram_quantile(0.95, sum by (route, le) (rate(http_request_duration_seconds_bucket[5m]))))
```

**Panel B — কোন endpoint সবচেয়ে বেশি মোট সময় খেয়েছে**
```promql
topk(5, sum by (route) (rate(http_request_duration_seconds_sum[5m])))
```
আমার সিস্টেমে —
Panel A জিতেছে: `<বসাও, যেমন /api/search>`
Panel B জিতেছে: `<বসাও, যেমন /api/notes>`

**কেন আলাদা:** Panel A বলে *এক request-এ* কে বেশি সময় নেয়। Panel B বলে
*মোট* সময় কোথায় যাচ্ছে = গড় সময় × কতবার ডাকা হচ্ছে। `/api/search` হয়তো
প্রতিবার ধীর কিন্তু কম ডাকা হয়; `/api/notes` মাঝারি ধীর কিন্তু সবচেয়ে বেশি
ডাকা হয়, তাই server-এর বেশিরভাগ সময় ওখানেই যায়। ঠিক করতে হলে B-এর
endpoint আগে ঠিক করলে লাভ বেশি।

**Panel C — DB query: avg আর p99**
```promql
sum by (query_name) (rate(db_query_duration_seconds_sum[5m])) / sum by (query_name) (rate(db_query_duration_seconds_count[5m]))
histogram_quantile(0.99, sum by (query_name, le) (rate(db_query_duration_seconds_bucket[5m])))
```
avg আর p99-এর ফাঁক বড় মানে বেশিরভাগ request দ্রুত, কিন্তু কিছু request খুব ধীর।

**Panel D — সবচেয়ে ধীর query আর কতবার চলে**
```promql
histogram_quantile(0.99, sum by (query_name, le) (rate(db_query_duration_seconds_bucket[5m])))
sum by (query_name) (rate(db_query_duration_seconds_count[5m]))
```
সবচেয়ে ধীর: `<বসাও, সম্ভবত stats বা search_notes>`
সবচেয়ে বেশিবার চলে: `<বসাও, সম্ভবত tags_for_note>` — এই দুইটা এক নয়, আর
এটাই আসল কথা: `tags_for_note` এক একবারে দ্রুত, কিন্তু N+1-এর কারণে এত বার
চলে যে মোট খরচ বেশি।

**Panel E — N+1 ধরার panel**
```promql
sum by (route) (rate(db_queries_per_request_sum[5m])) / sum by (route) (rate(db_queries_per_request_count[5m]))
```
`/api/notes` দেখায় ≈ **21**, বাকি সব 1–2। ২০টা note আনতে ১ + ২০ = ২১টা query।

**Panel F — ক্ষতিকর query per second**
```promql
sum by (query_name) (rate(db_query_duration_seconds_count[5m]))
  - sum by (query_name) (rate(db_query_duration_seconds_bucket{le="0.1"}[5m]))
```
**threshold কেন 0.1s:** Panel C-তে আমার সাধারণ query time `<বসাও, যেমন 1.5ms>`।
মানে 100ms আমার normal-এর প্রায় **৭০ গুণ** — এইটা স্পষ্টভাবে অস্বাভাবিক।
গোল সংখ্যা বলে নেইনি, নিজের ডেটা দেখে নিয়েছি।
(যদি normal 20ms হয়, তাহলে threshold 250ms নিতাম।)

**Panel G — কত row ফেরত আসছে**
```promql
histogram_quantile(0.95, sum by (query_name, le) (rate(db_rows_returned_bucket[5m])))
```
`limit=5000` দেওয়ায় `list_notes` এর p95 হাজারের ঘরে চলে গেছে।
**আমি max limit কত রাখতাম:** 100। client বেশি চাইলে API-র উচিত
`400 Bad Request` দেওয়া, অথবা চুপচাপ 100-এ নামিয়ে এনে response-এ
`"limit_applied": 100` জানিয়ে দেওয়া। সাথে cursor/keyset pagination দেওয়া,
যাতে বেশি ডেটা লাগলে page করে নিতে পারে।

**Panel H — tenant অনুযায়ী error rate আর p95**
```promql
sum by (tenant) (rate(http_requests_total{status=~"5.."}[5m])) / sum by (tenant) (rate(http_requests_total[5m]))
histogram_quantile(0.95, sum by (tenant, le) (rate(http_request_duration_seconds_bucket[5m])))
```
সবচেয়ে খারাপ tenant: **acme**।
**কারণ কোনটা — বেশি ডেটা না ভারী request?** দুইটাই আছে, কিন্তু প্রমাণ করেছি
ভারী request-ই মূল কারণ:
- acme-র note সংখ্যা 30,000, বাকিদের 5,000 (বেশি ডেটা — সত্যি)
- কিন্তু আমি load script-এ acme-কে `?limit=5000` পাঠাচ্ছি, বাকিদের `limit=20`
- প্রমাণ: acme-কে `limit=20` দিয়ে চালালে তার p95 বাকিদের কাছাকাছি নেমে আসে
  (`<বসাও: আগে X ms, পরে Y ms>`)। তাই আসল কারণ request-এর আকার, শুধু ডেটার
  পরিমাণ না। Panel G-ও এটাই দেখায় — acme-র rows_returned অনেক বেশি।

**Panel I — saturation**
```promql
http_requests_in_flight
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))
```
burst দেওয়ার সময় in-flight লাফ দিয়েছে `<বসাও>` এ, আর latency
`<একই সময়ে / কয়েক সেকেন্ড পরে>` বেড়েছে।
**এর মানে:** latency যদি concurrency-র সাথে সাথেই বাড়ে, তাহলে bottleneck
নিচের দিকে (DB connection pool মাত্র ১০টা — বাকিরা লাইনে দাঁড়ায়)। দেরিতে
বাড়লে বুঝতাম কোথাও queue জমছে, সাথে সাথে না। আমার ক্ষেত্রে
`<বসাও>` — তাই bottleneck `<DB pool / CPU>`।

## Task 33 — alert

- **threshold:** `<বসাও, যেমন 0.5s>` — আমার normal p95 `<বসাও>`, তার প্রায়
  ৩–৪ গুণ। normal-এর কাছাকাছি দিলে দিনে দশবার মিথ্যা alert আসত।
- **`for` duration:** `1m`।
- **`for: 0s` দিলে কী হয়:** একটামাত্র ধীর মুহূর্তেই alert বাজবে — deploy,
  backup, বা এক সেকেন্ডের spike-এও। এত মিথ্যা alert এলে মানুষ alert দেখা
  বন্ধ করে দেয় (alert fatigue), তখন আসল সমস্যাও চোখ এড়িয়ে যায়।
- **লম্বা `for` কোন সমস্যা সমাধান করে:** সমস্যাটা **স্থায়ী** কিনা তা নিশ্চিত করে।
  ক্ষণিকের spike নিজে নিজে ঠিক হয়ে যায়; ১ মিনিট ধরে খারাপ থাকা মানে সত্যিই
  কিছু ভেঙেছে।

## Task 34 — একটা সমস্যা ঠিক করা (সমস্যা ৩: `tags.note_id` এ index নাই)

**EXPLAIN ANALYZE আগে:**
```
<এখানে paste করো — Seq Scan on tags ... rows=150000 ... actual time=XX ms>
```
**পরে:**
```
<এখানে paste করো — Index Scan using idx_tags_note_id ... actual time=0.0X ms>
```
Grafana-তে ঠিক করার সময়টায় annotation দিয়েছি, Panel C/E-তে লাইন নিচে নেমে গেছে।

**খরচ কত:**
- index-এর size: `<বসাও, যেমন 3.3 MB>`
- 1000 row INSERT: আগে `<বসাও ms>`, পরে `<বসাও ms>` — কারণ প্রতিটা INSERT-এ
  এখন index-ও update করতে হয়। পড়া দ্রুত হয়, লেখা একটু ধীর, disk-ও লাগে।

**পরের বার কোনটা ঠিক করতাম:** N+1 (সমস্যা ১)। কারণ Panel B বলছে মোট সময়ের
সবচেয়ে বড় অংশ `/api/notes` খাচ্ছে আর Panel E বলছে সেটা প্রতি request-এ ২১টা
query করছে। ঠিক করার আগে মাপতাম: `WHERE note_id = ANY($1)` করলে
`db_queries_per_request` ২১ থেকে ২ এ নামে কিনা, আর `/api/notes` এর p95 কতটা কমে।

---

# B4

## Task 35 — কয়টা node
`<এক node / দুই node — এখানে সত্যি কথা লেখো>`। আমার ক্ষেত্রে
`<এক node, কারণ একটাই VPS>`।

## Task 37 — rolling update-এর ফলাফল
```
<awk ... | uniq -c এর output বসাও>
```
`<যদি non-200 থাকে, লুকাবে না — লিখে দাও কয়টা আর কেন>`
সম্ভাব্য কারণ: healthcheck-এর `start-period` শেষ হওয়ার আগেই routing mesh
নতুন container-এ traffic পাঠিয়েছে, অথবা app-এ graceful shutdown
(SIGTERM এলে চলমান request শেষ করে বন্ধ হওয়া) নেই।
`order: start-first` দেওয়ার কারণে পুরানো container নতুনটা ready হওয়ার আগে
বন্ধ হয়নি — এটাই zero downtime-এর মূল setting।

## Task 38 — rollback
- deploy কমান্ড দেওয়ার সময়: `<বসাও>`
- rollback শেষ হওয়ার সময়: `<বসাও>`
- মোট: `<বসাও>` সেকেন্ড
- `UpdateStatus.State` = `rollback_completed`

**healthcheck না থাকলে কী হত?** Swarm শুধু দেখত process চলছে কিনা। আমার ভাঙা
v3-তে process দিব্যি চলত (শুধু `/healthz` 500 দিত), তাই swarm ভাবত সব ঠিক
আছে, চুপচাপ ৩টা replica-ই v3 করে দিত, rollback হত না — আর সব user 500 পেত।
মানে **healthcheck ছাড়া auto-rollback অর্থহীন**।

## Task 39 — limit বনাম reservation
- **limit** = সর্বোচ্চ সীমা। container এর বেশি নিলে kernel মেরে ফেলে (exit 137)।
- **reservation** = জায়গা বুকিং। task বসানোর আগে swarm দেখে node-এ এতটুকু
  ফাঁকা আছে কিনা; না থাকলে task **Pending** অবস্থায় বসে থাকে।

আমি `--reserve-memory 8G` দিয়ে দেখেছি:
`no suitable node (insufficient resources on 1 node)` — task চালুই হয়নি।
মানে reservation **scheduling**-এর ব্যাপার, limit **runtime**-এর ব্যাপার।
screenshot নিয়েই 64M এ ফিরিয়ে দিয়েছি, কারণ শেয়ার করা server-এ বড় reservation
ধরে রাখলে অন্য student-দের task বসতে পারত না।

## Task 40 — live traffic-এ scale down
```
<uniq -c output বসাও>
```
`<fail সংখ্যা>` টা fail হয়েছে। কারণ swarm container-কে SIGTERM দেয়, কিন্তু
আমার app চলমান request শেষ করার জন্য অপেক্ষা করে না। graceful shutdown
(`process.on('SIGTERM', () => server.close(...))`) যোগ করলে এটা শূন্যে নামত।

---

# B5

## Task 41 — PR pipeline
- ❌ FAILED run: `<link বসাও>`
- ✅ PASSED run: `<link বসাও>`

pipeline-এ শুধু build করেই থামিনি — image চালিয়ে `curl /healthz` করেছি।
কারণ image দিব্যি build হয়ে যেতে পারে অথচ চালু হলেই crash করে (ভুল CMD, missing
file, ভুল user permission)। build সবুজ মানেই app চলে — এটা ভুল ধারণা।

## Task 42 — cache
| run | সময় |
|---|---|
| cold (cache ছাড়া) | `<বসাও>` |
| warm (cache সহ) | `<বসাও>` |
| লাভ | `<বসাও>` |

দুই জায়গায় cache দিয়েছি: `actions/setup-node` এর npm cache আর docker buildx-এর
`type=gha` layer cache।

## Task 43 — credential
`AWS_SECRET_ACCESS_KEY` বা কোনো static key repo secret-এ রাখিনি। GHCR-এ push
করেছি `secrets.GITHUB_TOKEN` দিয়ে — এটা GitHub প্রতিটা run-এর জন্য নিজে বানায়
আর run শেষ হলেই অকেজো হয়ে যায়। তাই কোনো দীর্ঘমেয়াদি credential কোথাও নেই।
(VPS deploy-এর জন্য SSH key secret লেগেছে — সেটা সীমিত permission-এর deploy
key; Scenario C-তে AWS-এর জন্য OIDC ব্যবহার করেছি, কোনো key ছাড়াই।)

**multi-arch (`linux/amd64,linux/arm64`) কেন দরকার হতে পারে:** আমার laptop
Apple Silicon (arm64), কিন্তু VPS amd64। এক আর্কিটেকচারে বানানো image অন্যটাতে
`exec format error` দেয়। দুইটা একসাথে build করলে যেকোনো মেশিনে একই tag কাজ করে।
`<আমি করেছি / করিনি — সত্যি লেখো>`

## Task 45 — deploy fail হওয়ার পরেও production কেন বেঁচে ছিল

`docker service update` **rolling** ভাবে কাজ করে: একবারে একটা task, আর
`order: start-first` মানে নতুনটা healthy না হওয়া পর্যন্ত পুরানোটা চলতেই থাকে।
নতুন image ভাঙা হলে healthcheck fail করে, `failure_action: rollback` চালু হয়ে
আগের image-এ ফিরে যায়। তাই user কিছুই টের পায়নি।

**যদি `docker service rm` করে আবার বানাতাম:** service মুছে যাওয়ার মুহূর্তেই
পুরো downtime শুরু হত। নতুন image ভাঙা হলে ফেরার কোনো পথ থাকত না — আগের
container আর নেই, rollback-এর জন্য কিছুই নেই। manual ভাবে পুরানো tag খুঁজে
আবার deploy করা লাগত, ততক্ষণ site বন্ধ।

## Task 46 — safeguard

দুইটাই দিয়েছি:
- **`concurrency: deploy-main`** — একসাথে দুইটা deploy চলবে না।
  *যে ঘটনা আটকায়:* দ্রুত পরপর দুইটা merge হলে দুইটা deploy job একসাথে চলত।
  পুরানো commit-এর job পরে শেষ হয়ে নতুন version-কে **চাপা দিয়ে দিত** — অর্থাৎ
  production-এ পুরানো code ফিরে আসত, অথচ GitHub-এ দেখাত সব সবুজ।
- **`timeout-minutes`** — কোনো step ঝুলে গেলে (যেমন registry থেকে উত্তর না
  আসা) job অনন্তকাল চলত, runner minute শেষ হত আর deploy queue আটকে থাকত।
