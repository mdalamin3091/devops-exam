# ============================================================
#  ধাপ ১ — package install করে test চালাই
# ============================================================
FROM node:20-alpine AS build
WORKDIR /app

# আগে শুধু package.json copy করি, তারপর install।
# এতে source বদলালেও npm install আবার চলে না (layer cache)।
COPY package*.json ./
RUN npm ci

COPY src ./src
COPY test ./test
RUN npm test

# test শেষ, এখন dev package (supertest) ফেলে দিই
RUN npm prune --omit=dev

# ============================================================
#  ধাপ ২ — আসল image. এখানে কোনো test, dev package, npm cache নাই
# ============================================================
FROM node:20-alpine
ENV NODE_ENV=production
ENV PORT=3000

# Task 38 এর জন্য: --build-arg BROKEN=1 দিলে /healthz 500 দিবে
ARG BROKEN=0
ENV BROKEN=${BROKEN}

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/src          ./src
COPY --chown=node:node package.json ./

# node image-এ 'node' নামে non-root user আগে থেকেই আছে
USER node

EXPOSE 3000

# container সত্যিই কাজ করছে কিনা docker নিজেই দেখবে
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.js"]
