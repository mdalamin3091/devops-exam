# Scenario A — উত্তর

**EXAM TOKEN:** `alamin-vmi3536696-1788528499-d41f1787`
**Server IP:** `169.58.246.108`

## নাম বদলের টেবিল (শেয়ার করা server, ৬ জন একসাথে)

আমাদের ল্যাব server-এ একই সময়ে ৬ জন এই exam দিচ্ছে। সবাই `alice`, `/srv/app`,
`myapp.service`, port `3001` ব্যবহার করলে একজনের কাজ আরেকজন মুছে ফেলত। তাই সব
নামের শেষে আমার prefix `_alamin` আর আলাদা port block ব্যবহার করেছি।

| Exam-এ যা লেখা | আমি যা ব্যবহার করেছি |
|---|---|
| alice, bob, carol, dan | alice_alamin, bob_alamin, carol_alamin, dan_alamin |
| devs, ops, auditor | devs_alamin, ops_alamin, auditor_alamin |
| /srv/app | /srv/app_alamin |
| myapp.service | myapp_alamin.service (আর myapp2_alamin.service) |
| myappuser | myappuser_alamin |
| port 3001 / 3002 | 30101 / 30102 |
| nginx port 80 | 30180 |
| port 8080 / 9090 (A2) | 30108 / 30109 |
| /var/log/healthcheck.log | /var/log/healthcheck_alamin.log |

nginx-এ `upstream` আর `limit_req_zone` এর নামও `backend_alamin`, `api_alamin` রেখেছি —
এই নামগুলো পুরো nginx-এ global, দুইজন একই নাম দিলে `nginx -t` fail করে আর সবার
reload আটকে যায়।

---

# A1

## Task 2 — dan কেন নাম দেখতে পায় কিন্তু ভিতরে পড়তে পারে না

Linux-এ folder-এর permission আর file-এর permission আলাদা। ফাইলের নাম আসলে
folder-এর ভিতরে লেখা থাকে, ফাইলের ভিতরে না। তাই folder-এ `r` (নাম পড়া) আর `x`
(ভিতরে ঢোকা) থাকলেই `ls -l` কাজ করে। আমি ACL দিয়ে dan-কে শুধু `secrets`
**folder**-এ `rx` দিয়েছি (`setfacl -m u:dan_alamin:rx`), কিন্তু
`db-password.txt` **file**-এ কোনো ACL দেইনি — সেটা `0640 root:ops_alamin` আছে।
dan `ops_alamin` group-এ নাই, তাই file-এর "other" permission `---` তার জন্য প্রযোজ্য
হয় আর `cat` করলে Permission denied আসে।

# A2

## Task 6 — sudo ছাড়া আর sudo দিয়ে output আলাদা কেন

`ss` আর `lsof` PID/program-এর নাম নেয় `/proc/<pid>/` থেকে। অন্য user-এর
process-এর `/proc` তথ্য সাধারণ user পড়তে পারে না। তাই sudo ছাড়া চালালে socket
আর port দেখা যায়, কিন্তু `users:(("python3",pid=...))` অংশ ফাঁকা থাকে। sudo
দিয়ে চালালে root সব `/proc` পড়তে পারে, তাই PID, program নাম, user সব দেখা যায়।
নিজের চালানো process-এর তথ্য অবশ্য sudo ছাড়াও দেখা যায়।

## Task 7 — manual, systemd না cron?

`cat /proc/<PID>/cgroup` দেখে বুঝেছি। output-এ ছিল
`.../user.slice/user-1000.slice/session-XX.scope` — মানে এটা আমার SSH
session-এর নিচে, হাতে চালানো। systemd service হলে সেখানে
`system.slice/<name>.service` লেখা থাকত, cron হলে parent process `cron` হত
(`ps -o ppid=` দিয়েও দেখেছি)।

**systemd হলে `kill -9` দিলে কী হয়?** কিছুই লাভ হয় না — process মরবে, কিন্তু
`Restart=` সেট থাকলে systemd সাথে সাথে আবার চালু করে দিবে, port আবার আটকে যাবে।
তখন `systemctl stop <name>` (আর দরকার হলে `disable`) দিতে হয়।

আমারটা হাতে চালানো ছিল, তাই `sudo kill <PID>` (SIGTERM) দিয়েই বন্ধ করেছি —
SIGKILL দরকার হয়নি, কারণ SIGTERM দিলে program নিজে গুছিয়ে বন্ধ হয়।
তারপর `sudo ss -lptn "sport = :30108"` খালি output দিয়েছে = port free।

## Task 8 — "timed out" আর "connection refused" এর পার্থক্য

- **Connection refused** — packet server পর্যন্ত পৌঁছেছে, কিন্তু ওই port-এ কেউ
  listen করছে না, তাই kernel সাথে সাথে RST পাঠিয়ে দিয়েছে। অর্থাৎ network ঠিক
  আছে, **app চলছে না** বা ভুল port-এ চলছে।
- **Timed out** — কোনো উত্তরই আসেনি। মাঝখানে **firewall বা cloud security
  group** packet চুপচাপ drop করে দিচ্ছে (`DROP`, `REJECT` না)।

আমার ক্ষেত্রে timeout এসেছিল, কারণ app শুধু server-এর ভিতরে চলছিল আর firewall
ওই port বাইরের জন্য খোলা ছিল না। `curl localhost` কাজ করছিল মানে app ঠিক আছে,
সমস্যা network layer-এ।

---

# A4

## Task 13 — production-এ restart limit কেন দরকার

অসীম restart মানে crash loop। DB down থাকলে app প্রতি সেকেন্ডে উঠে-পড়ে CPU,
disk, log সব খেয়ে ফেলে আর DB-তে connection ঝড় তোলে — যে সমস্যা ছোট ছিল সেটা
বড় করে দেয়। Limit থাকলে systemd `failed` অবস্থায় থেমে যায়, monitoring/alert
সাথে সাথে ধরতে পারে, আর log-এ আসল প্রথম error টা খুঁজে পাওয়া যায় (হাজার হাজার
restart log-এর নিচে চাপা পড়ে না)।

**`Restart=always` + limit ছাড়া দিলে কী হয়:** ৬ বার crash করার পরেও service
`active (running)` দেখায়, কারণ প্রতিবার নতুন করে উঠে যায়। বাইরে থেকে দেখলে
মনে হয় সব ঠিক আছে।

**terminal-এ না তাকিয়ে production-এ কীভাবে বুঝব:**
- `systemctl show myapp_alamin -p NRestarts` — সংখ্যা বাড়তেই থাকবে
- `journalctl -u myapp_alamin | grep -c Started` — অস্বাভাবিক বেশি
- Prometheus-এ process uptime বারবার শূন্য হয়ে যাওয়া / restart counter-এ alert
- app-এর p95 latency আর error rate লাফাবে

## Task 15 — `Restart=on-failure` কেন ধরতে পারল না

`Restart=on-failure` শুধু তখনই কাজ করে যখন **process শেষ হয়ে যায়** — non-zero
exit code বা signal নিয়ে মরে। `/hang` হিট করার পর আমার process বেঁচেই আছে,
port ধরে রেখেছে, TCP connection accept-ও করছে — শুধু কোনো HTTP response
পাঠাচ্ছে না। systemd-এর কাছে process ID টা দিব্যি জীবিত, তাই তার দিক থেকে কোনো
"failure" ঘটেনি এবং সে কিছুই করে না। এই জন্য বাইরে থেকে **আসল কাজ করে কিনা**
সেটা পরীক্ষা করা দরকার। আমি timer + `curl -sf --max-time 5 /healthz` দিয়ে
প্রতি ৩০ সেকেন্ডে check করি, fail করলে `systemctl restart` চালাই। এটাই
liveness check-এর মূল ধারণা — process বেঁচে থাকা আর service সুস্থ থাকা এক জিনিস না।

---

# A5

## Task 17 — algorithm-এর পার্থক্য

আমার ফলাফল:

| Algorithm | backend 30101 | backend 30102 |
|---|---|---|
| least_conn | `52` | `48` |
| ip_hash | `100` | `0` |

- **least_conn** — যার হাতে এই মুহূর্তে কম active connection তাকে দেয়। সব
  request সমান দ্রুত হলে round robin-এর মতোই লাগে; কিছু request ধীর হলে
  (যেমন `/slow`) পার্থক্য বোঝা যায়।
- **ip_hash** — client IP থেকে hash করে সবসময় একই backend-এ পাঠায়। তাই আমার
  একই মেশিন থেকে ১০০টা request পুরোটাই একটা backend-এ গেছে। session
  memory-তে রাখলে দরকার হয়, কিন্তু load সমান হয় না।

## Task 18 — failover-এর হিসাব

`max_fails=3 fail_timeout=10s` দিয়ে:
- backend বন্ধ করার পর fail হয়েছে: `<এখানে বসাও>` টা request
- ফিরে আসতে লেগেছে: `<এখানে বসাও>` সেকেন্ড

**কেন এই সংখ্যা:** nginx open source **passive** health check করে — সে
নিজে থেকে backend-কে ping করে না, শুধু আসল request fail হলে গোনে।
`fail_timeout=10s`-এর ভিতরে `max_fails=3` বার fail হলে সে backend-কে ১০ সেকেন্ডের
জন্য বাদ দেয়। তাই প্রথমে অল্প কয়েকটা request নষ্ট হয়। ১০ সেকেন্ড পর nginx
আবার একটা request পাঠিয়ে পরীক্ষা করে — backend ফিরে এলে ওই মুহূর্তেই rotation-এ
ফিরে আসে। এই জন্য restart করার পর সাথে সাথে না, বড়জোর `fail_timeout` সময় পরে
traffic ফিরে যায়।

`max_fails=1 fail_timeout=30s` দিয়ে:
- fail হয়েছে: `<এখানে বসাও>` টা (কম, কারণ ১ বার fail-এই বাদ)
- ফিরতে লেগেছে: `<এখানে বসাও>` সেকেন্ড (বেশি, কারণ ৩০ সেকেন্ড বাদ থাকে)

মানে ট্রেড-অফ: তাড়াতাড়ি বাদ দিলে user কম error দেখে, কিন্তু ক্ষণিকের network
সমস্যাতেও ভালো backend অনেকক্ষণ বসে থাকে।

## Task 19 — timeout বাড়ানো কেন ভুল সমাধান

`proxy_read_timeout` বাড়ালে 504 চলে যায় ঠিকই, কিন্তু আসল সমস্যা — request-টা
৪৫ সেকেন্ড লাগে — রয়েই গেল। ৫০০ জন user একসাথে `/slow` মারলে ৫০০টা connection
৪৫ সেকেন্ড ধরে nginx-এর worker connection আর app-এর thread/socket দখল করে
বসে থাকবে। nginx-এর `worker_connections` শেষ হয়ে গেলে **অন্য সব দ্রুত
endpoint-ও** সাড়া দেওয়া বন্ধ করে দেয়। অর্থাৎ একটা ধীর endpoint পুরো site
ফেলে দেয়। এটাকে বলে queue জমে যাওয়া।

**production-এ আমি যা করতাম:**
1. কাজটা background job/queue-তে পাঠাতাম (Redis/RabbitMQ + worker), API সাথে
   সাথে `202 Accepted` আর একটা job id দিত।
2. client পরে `GET /jobs/<id>` দিয়ে status দেখত (polling), বা WebSocket/SSE
   দিয়ে জানত।
3. ফলাফল cache করতাম যাতে বারবার হিসাব না হয়।
4. timeout ছোট রাখতাম (যেমন ১০ সেকেন্ড) — দ্রুত fail করা ধীরে ঝুলে থাকার চেয়ে ভালো।

## Task 20 — rate limit ফলাফল

`rate=5r/s burst=5 nodelay` দিয়ে ৫০টা request-এ পেয়েছি:
`<এখানে uniq -c output বসাও, যেমন 10 200 / 40 429>`

`rate=5r/s` মানে সেকেন্ডে ৫টা। `burst=5` মানে হঠাৎ ৫টা extra জমা রাখা যাবে,
`nodelay` মানে ওই ৫টা সাথে সাথে পাস করবে (queue-তে ধীর করে রাখবে না)। বাকি সব
সাথে সাথে `429 Too Many Requests` পায়।
