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
