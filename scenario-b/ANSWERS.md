# Scenario B — উত্তর

**EXAM TOKEN:** `alamin-vmi3536696-1788528499-d41f1787`
**Server:** `169.58.246.108`

---

# B1

## Task 22 — image ছোট করা

| image | size (disk) |
|---|---|
| `Dockerfile.naive` — single stage | **1.67 GB** |
| `Dockerfile` — multi-stage | **207 MB** |
| কমেছে | **প্রায় ৮৮%** |

**যা বাদ দিয়েছি:**

- **base image** — `node:20` (Debian, ~1.1 GB) সরিয়ে `node:20-alpine` (~130 MB)
- **build tool** — naive-এ `build-essential`, `python3`, `git`, `curl`, `vim`, `procps`
  apt দিয়ে বসিয়েছিলাম। app চালাতে এর একটাও লাগে না
- **dev dependency** — `npm prune --omit=dev` দিয়ে supertest বাদ
- **test folder আর npm cache** — runtime stage-এ `COPY --from=build` দিয়ে শুধু
  `node_modules` আর `src` এনেছি, তাই test আর cache আসেইনি

## Task 23 — layer cache

| build | সময় |
|---|---|
| কিছু না বদলে (সব cached) | **2.3 s** |
| `src/server.js`-এ একটা comment দেওয়ার পর | **15.1 s** (`real 0m17.054s`) |

**CACHED ছিল:** `WORKDIR`, `COPY package*.json`, `RUN npm ci`, আর runtime stage-এর
`COPY --from=build node_modules`।

**আবার চলেছে:** `COPY src` → `COPY test` → `npm test` (4.4s) → `npm prune` (4.5s)
→ runtime stage-এর `COPY src` আর `COPY package.json`।

**কেন:** Docker উপর থেকে নিচে layer মেলায় — একটা layer বদলালে তার নিচের সব বাতিল।
`package.json` বদলায়নি, তাই `npm ci` cache থেকেই এসেছে; শুধু source copy করার
layer থেকে নিচেরগুলো আবার চলেছে। এই জন্যই আগে `package*.json` copy করে install
করি, তারপর source copy করি — উল্টো করলে (`COPY . .` আগে) প্রতিবার সব package
নতুন করে নামত।

---

# B2

## Task 26 — `depends_on` কেন যথেষ্ট না

`depends_on: [postgres]` শুধু বলে "postgres **container start** হওয়ার পরে app start
করো"। কিন্তু container চালু হওয়া আর postgres **query নেওয়ার জন্য প্রস্তুত** হওয়া এক
জিনিস না — প্রথমবার সে database initialise করে, তাতে কয়েক সেকেন্ড লাগে। ওই ফাঁকে
আমার app connect করতে গিয়ে `ECONNREFUSED` পেয়ে `process.exit(1)` করেছে
(`b2-task26-dependson-crash.png`)।

**সমাধান:** postgres-এ `healthcheck: pg_isready` দিয়েছি আর app-এ
`depends_on: postgres: condition: service_healthy` লিখেছি। এখন compose সত্যিই
ready হওয়া পর্যন্ত অপেক্ষা করে, app এক চেষ্টাতেই উঠে যায়
(`b2-task26-healthy-start.png`)।

Production-এ আসলে দুইটাই রাখা ভালো — healthcheck, আর app-এ retry। কারণ DB পরে
restart হলে compose-এর healthcheck আর কাজে আসে না, তখন app-এর নিজের retry লাগে।

**যেটা করতে গিয়ে আটকেছিলাম:** একবার `.env` ছাড়া compose চালিয়ে ফেলেছিলাম, তাই
`POSTGRES_PASSWORD` ফাঁকা নিয়ে volume তৈরি হয়ে গিয়েছিল। পরে ঠিক password দিলেও
`password authentication failed` আসছিল — কারণ `POSTGRES_PASSWORD` শুধু **প্রথমবার**
data folder তৈরির সময় কাজ করে, volume আগে থেকে থাকলে পুরানো password-ই থাকে।
`docker compose down -v` দিয়ে volume মুছে আবার তুলতে হয়েছে।

## Task 27 — `-v` flag কী করল

- `docker compose down` → শুধু container মুছে, **volume রেখে দেয়**।
  `docker volume ls` এ `notes_alamin_pgdata` তখনো ছিল, তাই `up` করার পর ৫০,০০০ note
  ঠিকই ফিরে এসেছে।
- `docker compose down -v` → named volume-ও মুছে ফেলে। Postgres-এর সব data ওই
  volume-এ থাকে, তাই `up` করার পর database একদম খালি — `/api/stats` কিছুই দেয়নি।

**Recovery:** `down -v` দেওয়ার আগে `pg_dump -U notes notesdb > notes-backup.sql`
দিয়ে backup নিয়ে রেখেছিলাম। volume মুছে যাওয়ার পর
`psql -U notes -d notesdb < notes-backup.sql` দিয়ে schema আর data দুইটাই ফিরিয়ে
এনেছি, `/api/stats` আবার আগের সংখ্যা দেখাচ্ছে।

## Task 28a — exit 137

- **যা করে বানালাম:** `docker run --memory=50m python:3-alpine python -c "x=[0]*100000000"`
- **উপসর্গ:** container সাথে সাথে মরে গেল, exit code 137
- **যে কমান্ডে ধরা পড়ল:** `docker inspect --format='{{.State.OOMKilled}}'` → `true`,
  আর `dmesg` এ kernel-এর `Out of memory: Killed process` লাইন
- **মানে:** 137 = 128 + 9 → SIGKILL। সাথে `OOMKilled: true` মানে kernel-এর OOM
  killer মেরেছে, memory limit পার করায়। (143 = 128 + 15 = SIGTERM — কেউ ভদ্রভাবে
  থামতে বলেছে, সেটা আলাদা জিনিস।)
- **ঠিক করা:** limit বাড়ানো, নাহলে app কেন এত memory নিচ্ছে সেটা দেখা

> exam-এ `deploy: resources: limits:` লেখা ছিল, কিন্তু plain `docker compose up`-এ
> `deploy:` block **ignore হয়** — ওটা শুধু Swarm-এ কাজ করে (বা `--compatibility` দিলে)।
> Compose-এ limit দিতে হলে `mem_limit:` লাগে। তাই `docker run --memory=50m` দিয়ে
> দেখিয়েছি।

## Task 28b — service নামে DB পাওয়া যায় না, IP দিয়ে যায়

- **যা করে বানালাম:** `docker run` দিয়ে আলাদা container চালিয়েছি, সেটা default
  `bridge` network-এ গেছে; postgres আছে compose-এর নিজের network-এ
- **উপসর্গ:** `getent hosts postgres` কিছুই দেয় না, কিন্তু `ping <IP>` কাজ করে
- **যে কমান্ডে ধরা পড়ল:**
  `docker inspect <c> --format '{{json .NetworkSettings.Networks}}' | jq` —
  দুই container দুই network-এ
- **মানে:** Docker-এর built-in DNS শুধু **user-defined network**-এ service নাম
  resolve করে। পুরানো default `bridge` network-এ DNS-ই নাই
- **ঠিক করা:** `docker network connect notes_alamin_default lonely_alamin` — এরপর
  নাম কাজ করে

## Task 28c — mount করার পরে folder খালি

- **যা করে বানালাম:** `./empty-folder:/app/node_modules`
- **উপসর্গ:** app চালু হয় না, log-এ `Cannot find module 'express'`;
  `ls /app/node_modules` খালি
- **যে কমান্ডে ধরা পড়ল:** `docker inspect --format '{{json .Mounts}}' | jq` —
  ওখানে bind mount টা দেখা যায়
- **মানে:** bind mount ওই path-এ image-এ যা ছিল তা **ঢেকে দেয়**, মেশায় না
- **named volume আলাদা কীভাবে:** named volume **প্রথমবার তৈরি হওয়ার সময়** image-এর
  ওই folder-এর ফাইলগুলো volume-এ কপি করে নেয়, তাই node_modules খালি হত না।
  কিন্তু পরে image বদলালেও volume পুরানো ফাইল ধরে রাখে — সেটা আবার আরেক ধরনের বিভ্রান্তি
- **ঠিক করা:** override ছাড়া `docker compose up -d --force-recreate app`

## Task 28d — port publish করা তবু connection refused

- **যা করে বানালাম:** `BIND_HOST=127.0.0.1` দিয়ে app চালানো
- **উপসর্গ:** `docker ps` এ `0.0.0.0:30103->3000/tcp` দেখাচ্ছে, তবু host থেকে
  `curl localhost:30103` → connection refused
- **যে কমান্ডে ধরা পড়ল:** container-এর ভিতর থেকে
  `node -e "fetch('http://127.0.0.1:3000/healthz')"` কাজ করে — মানে app চলছে,
  শুধু বাইরের interface-এ শোনে না
- **মানে:** container-এর ভিতরে `127.0.0.1` মানে **container-এর নিজের** loopback।
  Docker-এর port forward container-এর eth0-তে আসে, loopback-এ না
- **ঠিক করা:** `0.0.0.0` তে listen করানো

---

# B3
