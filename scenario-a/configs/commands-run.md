# Scenario A — আমি যে কমান্ডগুলো চালিয়েছি

প্রতিটা অংশের নিচে সেই evidence screenshot-এর নাম দেওয়া আছে।
সব কমান্ড `alamin` user হিসেবে server-এ চালানো (Ubuntu, Contabo VPS `vmi3536696`)।

**Isolation:** server-এ ৬ জন একসাথে exam দিচ্ছে, তাই সব নামের শেষে `_alamin`
আর আলাদা port block (30101, 30102, 30180, 30108, 30109) ব্যবহার করেছি।

প্রতিটা screenshot-এর আগে চালানো হয়েছে:
```bash
echo "$EXAM_TOKEN | $(date)"
```

---

# A1 — Task 1 : user, group, folder, permission

```bash
# group
sudo groupadd devs_alamin
sudo groupadd ops_alamin
sudo groupadd auditor_alamin

# user
sudo useradd -m -s /bin/bash alice_alamin
sudo useradd -m -s /bin/bash bob_alamin
sudo useradd -m -s /bin/bash carol_alamin
sudo useradd -m -s /bin/bash dan_alamin

# group membership
sudo usermod -aG devs_alamin alice_alamin
sudo usermod -aG devs_alamin bob_alamin
sudo usermod -aG ops_alamin carol_alamin
sudo usermod -aG devs_alamin carol_alamin      # carol devs যা পারে তাও পারবে
sudo usermod -aG auditor_alamin dan_alamin

# folder
sudo mkdir -p /srv/app_alamin/{src,config,secrets,logs,backups}
sudo chown root:root /srv/app_alamin
sudo chmod 755 /srv/app_alamin

sudo chown -R root:devs_alamin /srv/app_alamin/src
sudo chmod 2770 /srv/app_alamin/src            # 2 = setgid, নতুন file devs group পাবে

sudo chown -R root:ops_alamin /srv/app_alamin/config
sudo chmod 2770 /srv/app_alamin/config

sudo chown -R root:devs_alamin /srv/app_alamin/logs
sudo chmod 2770 /srv/app_alamin/logs

sudo chown -R root:ops_alamin /srv/app_alamin/secrets
sudo chmod 750 /srv/app_alamin/secrets

# dummy file
echo "console.log('hello');" | sudo tee /srv/app_alamin/src/main.js
echo "app_name=myapp"        | sudo tee /srv/app_alamin/config/app.conf
echo "app started ok"        | sudo tee /srv/app_alamin/logs/app.log
echo "SuperSecret123!"       | sudo tee /srv/app_alamin/secrets/db-password.txt

sudo chown root:devs_alamin /srv/app_alamin/src/main.js /srv/app_alamin/logs/app.log
sudo chmod 660 /srv/app_alamin/src/main.js
sudo chmod 640 /srv/app_alamin/logs/app.log
sudo chown root:ops_alamin /srv/app_alamin/config/app.conf
sudo chmod 660 /srv/app_alamin/config/app.conf
sudo chown root:ops_alamin /srv/app_alamin/secrets/db-password.txt
sudo chmod 640 /srv/app_alamin/secrets/db-password.txt
```

প্রমাণ:
```bash
echo "$EXAM_TOKEN | $(date)"
ls -l /srv/app_alamin
getent group devs_alamin ops_alamin auditor_alamin
id alice_alamin ; id carol_alamin ; id dan_alamin
```
📸 `a1-task1-users-groups-perms.png`

---

# A1 — Task 2 : dan নাম দেখবে, ভিতরে পড়তে পারবে না (ACL)

```bash
sudo apt install -y acl

# auditor group কে পুরো folder-এ read
# rX = file হলে read, folder হলে read+enter (বড় হাতের X গুরুত্বপূর্ণ)
sudo setfacl -R -m g:auditor_alamin:rX /srv/app_alamin

# secret file থেকে সব ACL মুছে দাও -> শুধু root + ops পড়বে
sudo setfacl -b /srv/app_alamin/secrets/db-password.txt
sudo chown root:ops_alamin /srv/app_alamin/secrets/db-password.txt
sudo chmod 640 /srv/app_alamin/secrets/db-password.txt

# শুধু FOLDER-এ dan কে r+x
sudo setfacl -m u:dan_alamin:rx /srv/app_alamin/secrets
```

প্রমাণ:
```bash
echo "$EXAM_TOKEN | $(date)"
sudo -u dan_alamin ls -l /srv/app_alamin/secrets/
sudo -u dan_alamin cat /srv/app_alamin/secrets/db-password.txt   # Permission denied
getfacl /srv/app_alamin/secrets
getfacl /srv/app_alamin/secrets/db-password.txt                  # এখানে dan নাই
```
📸 `a1-task2-dan-cannot-cat.png`

---

# A1 — Task 3 : carol delete করতে পারবে না

```bash
# folder carol-এর, sticky bit সহ
sudo chown carol_alamin:ops_alamin /srv/app_alamin/backups
sudo chmod 1770 /srv/app_alamin/backups          # 1 = sticky bit

# backup file গুলো root বানাবে, carol না
echo "dummy backup data" | sudo tee /srv/app_alamin/backups/backup1.tar
echo "dummy backup data" | sudo tee /srv/app_alamin/backups/backup2.tar
echo "dummy backup data" | sudo tee /srv/app_alamin/backups/backup3.tar
sudo chown root:ops_alamin /srv/app_alamin/backups/*.tar
sudo chmod 640 /srv/app_alamin/backups/*.tar

# immutable flag — sticky bit folder-এর OWNER কে আটকায় না,
# আর এখানে owner carol নিজেই, তাই এই দ্বিতীয় স্তর লাগে
sudo chattr +i /srv/app_alamin/backups/backup1.tar \
               /srv/app_alamin/backups/backup2.tar \
               /srv/app_alamin/backups/backup3.tar
```

প্রমাণ:
```bash
echo "$EXAM_TOKEN | $(date)"
sudo ls -ld /srv/app_alamin/backups              # drwxrwx--T = sticky
sudo ls -l  /srv/app_alamin/backups
sudo lsattr /srv/app_alamin/backups              # ----i--------- = immutable
sudo -u carol_alamin rm -f /srv/app_alamin/backups/backup1.tar   # Operation not permitted
sudo -u carol_alamin touch /srv/app_alamin/backups/notun.txt     # কিন্তু লিখতে পারে
```
📸 `a1-task3-carol-cannot-delete.png`

---

# A1 — Task 4 : পূর্ণ sudo ছাড়া service restart

```bash
# আগে temp file-এ লিখে syntax check, তারপর বসানো।
# /etc/sudoers.d/ এ ভুল file বসলে server-এর ৬ জনেরই sudo নষ্ট হত।
cat > /tmp/myapp_sudo <<'EOF'
Cmnd_Alias MYAPP_CMDS = /usr/bin/systemctl restart myapp_alamin, /usr/bin/systemctl start myapp_alamin, /usr/bin/systemctl stop myapp_alamin, /usr/bin/systemctl status myapp_alamin
%devs_alamin ALL=(root) NOPASSWD: MYAPP_CMDS
EOF

sudo visudo -c -f /tmp/myapp_sudo                # parsed OK না হলে থামো
sudo install -m 440 -o root -g root /tmp/myapp_sudo /etc/sudoers.d/myapp_alamin
rm /tmp/myapp_sudo
sudo visudo -c                                   # পুরো sudoers ঠিক আছে কিনা

sudo cat /etc/sudoers.d/myapp_alamin
sudo -l -U alice_alamin
```

alice হয়ে প্রমাণ:
```bash
sudo passwd alice_alamin        # password দেওয়া হয়েছে, repo-তে লেখা হয়নি
echo "$EXAM_TOKEN | $(date)"
sudo -i -u alice_alamin
  sudo systemctl restart myapp_alamin     # কাজ করে
  sudo apt update                         # Sorry, user alice_alamin is not allowed
  exit
```
📸 `a1-task4-alice-restart-ok-apt-refused.png`

---

# A1 — ১২টা proof table

```bash
echo "$EXAM_TOKEN | $(date)"

# 1  alice src-এ লিখতে পারে
sudo -u alice_alamin bash -c "echo test >> /srv/app_alamin/src/main.js" ; echo "exit=$?"
# 2  alice log পড়তে পারে
sudo -u alice_alamin cat /srv/app_alamin/logs/app.log
# 3  alice service restart করতে পারে
sudo -i -u alice_alamin sudo systemctl restart myapp_alamin ; echo "exit=$?"
# 4  alice secret পড়তে পারে না
sudo -u alice_alamin cat /srv/app_alamin/secrets/db-password.txt
# 5  alice apt চালাতে পারে না
sudo -i -u alice_alamin sudo apt update
# 6  carol config-এ লিখতে পারে
sudo -u carol_alamin bash -c "echo x >> /srv/app_alamin/config/app.conf" ; echo "exit=$?"
# 7  carol secret পড়তে পারে
sudo -u carol_alamin cat /srv/app_alamin/secrets/db-password.txt
# 8  carol backup মুছতে পারে না
sudo -u carol_alamin rm -f /srv/app_alamin/backups/backup1.tar
# 9  dan নাম দেখতে পারে
sudo -u dan_alamin ls -l /srv/app_alamin/secrets/
# 10 dan secret পড়তে পারে না
sudo -u dan_alamin cat /srv/app_alamin/secrets/db-password.txt
# 11 dan লিখতে পারে না
sudo -u dan_alamin bash -c "echo x >> /srv/app_alamin/src/main.js"
# 12 dan service restart করতে পারে না
sudo passwd dan_alamin
sudo -i -u dan_alamin sudo systemctl restart myapp_alamin
```
📸 `a1-proof-table-1-to-12.png`

---

# A2 — Task 5 : port কে দখল করেছে

Terminal 1 (root process):
```bash
sudo python3 -m http.server 30108
```
Terminal 2 (normal user process):
```bash
python3 -m http.server 30109
```

Terminal 3 (তদন্ত):
```bash
echo "$EXAM_TOKEN | $(date)"
sudo ss -lptn "sport = :30108"              # PID = 2259950
sudo ls -l /proc/2259950/exe                # /usr/bin/python3.12
ps -o pid,user,lstart,cmd -p 2259950        # root, Sat Sep 5 11:22:50, full command
sudo lsof -i :30108
```
📸 `a2-task5-identify-process.png`

---

# A2 — Task 6 : sudo ছাড়া আর sudo দিয়ে

```bash
echo "$EXAM_TOKEN | $(date)"
ss -lptn | grep 30108              # process নাম দেখায় না
lsof -i :30108                     # খালি
sudo ss -lptn | grep 30108         # users:(("python3",pid=2259950,fd=3))
```
📸 `a2-task6-with-without-sudo.png`

---

# A2 — Task 7 : manual না systemd, আর ঠিকভাবে kill

```bash
echo "$EXAM_TOKEN | $(date)"
cat /proc/2259950/cgroup           # session-4931.scope = হাতে চালানো
systemctl status 2259950 | head -5
ps -o ppid= -p 2259950
sudo kill 2259950                  # SIGTERM যথেষ্ট, SIGKILL লাগেনি
sudo ss -lptn "sport = :30108"     # খালি output = port free
```
📸 `a2-task7-kill-and-free.png`

---

# A3 — Task 9 : healthcheck script

Script `~/bin/healthcheck.sh` (repo-তে `configs/healthcheck.sh`),
config `~/checks.conf` (repo-তে `configs/checks.conf`)।

```bash
mkdir -p ~/bin
nano ~/bin/healthcheck.sh          # configs/healthcheck.sh এর content
chmod +x ~/bin/healthcheck.sh
nano ~/checks.conf                 # configs/checks.conf এর content

# log file আগে বানিয়ে নিজের নামে করা, নাহলে normal user লিখতে পারে না
sudo touch /var/log/healthcheck_alamin.log
sudo chown $(whoami):$(whoami) /var/log/healthcheck_alamin.log
```

pass আর fail — দুইটাই দেখানো:
```bash
echo "$EXAM_TOKEN | $(date)"
~/bin/healthcheck.sh ~/checks.conf ; echo "exit=$?"

sudo systemctl stop myapp2_alamin
~/bin/healthcheck.sh ~/checks.conf ; echo "exit=$?"     # app-2 FAIL, exit=1
sudo systemctl start myapp2_alamin
~/bin/healthcheck.sh ~/checks.conf ; echo "exit=$?"
```
📸 `a3-task9-pass-and-fail.png`

---

# A4 — Task 12 : systemd unit

```bash
# login করতে পারে না এমন user
sudo groupadd myappuser_alamin
sudo useradd --system --no-create-home --shell /usr/sbin/nologin \
             -g myappuser_alamin myappuser_alamin

# app code
sudo cp ~/devops-exam/scenario-a/configs/app.js /srv/app_alamin/src/app.js
sudo chown root:devs_alamin /srv/app_alamin/src/app.js
sudo chmod 660 /srv/app_alamin/src/app.js

# app user কে শুধু পড়ার ACL (group permission না ভেঙে)
sudo setfacl -m u:myappuser_alamin:rx /srv/app_alamin /srv/app_alamin/src
sudo setfacl -m u:myappuser_alamin:r  /srv/app_alamin/src/app.js

sudo nano /etc/systemd/system/myapp_alamin.service      # configs/myapp_alamin.service
sudo nano /etc/systemd/system/myapp2_alamin.service     # configs/myapp2_alamin.service

sudo systemctl daemon-reload
sudo systemctl enable --now myapp_alamin myapp2_alamin
```

প্রমাণ:
```bash
echo "$EXAM_TOKEN | $(date)"
cat /etc/systemd/system/myapp_alamin.service
systemctl status myapp_alamin --no-pager
id myappuser_alamin
curl -s localhost:30101/ ; curl -s localhost:30102/
systemctl list-dependencies --after myapp_alamin | grep -i nginx
```
📸 `a4-task12-service-running.png`

---

# A4 — Task 13 : restart limit আর Restart=always

restart limit (`StartLimitIntervalSec=60`, `StartLimitBurst=5`):
```bash
echo "$EXAM_TOKEN | $(date)"
for i in $(seq 1 6); do curl -s localhost:30101/crash; sleep 2; done
systemctl status myapp_alamin --no-pager        # Active: failed (Result: exit-code)
sudo journalctl -u myapp_alamin -n 40 --no-pager
```
📸 `a4-task13-failed-state.png`

তারপর `Restart=always`, limit ছাড়া:
```bash
sudo systemctl reset-failed myapp_alamin
sudo nano /etc/systemd/system/myapp_alamin.service
#   Restart=on-failure  ->  Restart=always
#   StartLimitIntervalSec / StartLimitBurst লাইন দুইটা মুছে দেওয়া
sudo systemctl daemon-reload && sudo systemctl restart myapp_alamin

echo "$EXAM_TOKEN | $(date)"
for i in $(seq 1 6); do curl -s localhost:30101/crash; sleep 2; done
systemctl status myapp_alamin --no-pager        # এবার active (running)
systemctl show myapp_alamin -p NRestarts        # NRestarts=11
```
📸 `a4-task13-restart-always.png`

শেষে আগের অবস্থায় ফিরিয়ে আনা হয়েছে (`Restart=on-failure` + limit)।

---

# A4 — Task 14 : journalctl পাঁচটা query

> `sudo` লাগে, কারণ আমার user `adm` / `systemd-journal` group-এ নাই।

```bash
echo "$EXAM_TOKEN | $(date)"

# 1. শেষ ১০ মিনিট
sudo journalctl -u myapp_alamin --since "10 min ago" --no-pager

# 2. শুধু error বা তার চেয়ে খারাপ
sudo journalctl -u myapp_alamin -p err --no-pager

# 3a. এই boot
sudo journalctl -u myapp_alamin -b --no-pager | tail -20

# 3b. আগের boot
sudo journalctl -u myapp_alamin -b -1 --no-pager | tail -20
#    -> "No journal boot entry found" : server একবারও reboot হয়নি

# 4. JSON
sudo journalctl -u myapp_alamin -o json-pretty -n 2

# 5. live follow (অন্য terminal-এ restart দিয়ে)
sudo journalctl -u myapp_alamin -f
```
📸 `a4-task14-journalctl-1to5.png`

---

# A4 — Task 15 : বেঁচে আছে কিন্তু জবাব দেয় না (watchdog)

```bash
sudo nano /usr/local/bin/myapp_alamin-watchdog.sh          # configs/myapp_alamin-watchdog.sh
sudo chmod 755 /usr/local/bin/myapp_alamin-watchdog.sh
sudo nano /etc/systemd/system/myapp_alamin-watchdog.service
sudo nano /etc/systemd/system/myapp_alamin-watchdog.timer  # 30 সেকেন্ড পর পর

sudo systemctl daemon-reload
sudo systemctl enable --now myapp_alamin-watchdog.timer
systemctl list-timers | grep myapp_alamin
```

প্রমাণ:
```bash
echo "$EXAM_TOKEN | $(date)"
curl -s localhost:30101/hang
systemctl status myapp_alamin --no-pager | head -5    # এখনো active (running)
curl -m 3 localhost:30101/healthz                     # কোনো উত্তর নাই

sudo journalctl -u myapp_alamin-watchdog -n 20 --no-pager
#   -> "healthz FAILED -> restarting"  15:09:03
systemctl show myapp_alamin -p ActiveEnterTimestamp
#   -> Sat 2026-09-05 15:09:03 CEST   (একই সময়)
curl -s localhost:30101/healthz                       # আবার ok
```
📸 `a4-task15-watchdog-restart.png`

---

# A5 — Task 16 : reverse proxy + proxy header

```bash
sudo nano /etc/nginx/conf.d/myapp_alamin.conf     # configs/nginx-myapp.conf
sudo nginx -t && sudo systemctl reload nginx      # test pass না হলে reload করি না
```

প্রমাণ:
```bash
echo "$EXAM_TOKEN | $(date)"
curl -s localhost:30180/
curl -s localhost:30180/whoami
```
নিজের laptop থেকে:
```bash
curl -s http://169.58.246.108:30180/whoami
#   -> "x-real-ip": "103.75.139.27"   (আসল visitor IP)
#      "remoteAddress": "127.0.0.1"   (nginx নিজে)
```
📸 `a5-task16-whoami-real-ip.png`

---

# A5 — Task 17 : load balancing

```bash
sudo nginx -t && sudo systemctl reload nginx

# round robin (default)
for i in $(seq 1 100); do curl -s http://localhost:30180/ ; done | sort | uniq -c
#   52 backend-30101 / 48 backend-30102

# upstream block-এ least_conn / ip_hash on করে reload দিয়ে আবার
for i in $(seq 1 100); do curl -s http://localhost:30180/ ; done | sort | uniq -c
#   100 backend-30101  (এক client, তাই সব একটাতেই)

echo "$EXAM_TOKEN | $(date)"
```
📸 `a5-task17-roundrobin-vs-leastconn.png`

---

# A5 — Task 19 : /slow → 504, তারপর 200

```bash
echo "$EXAM_TOKEN | $(date)"

# location /slow এ proxy_read_timeout 5s দেওয়া
time curl http://localhost:30180/slow
#   -> 504 Gateway Time-out, real 0m10.843s
#      (৫ সেকেন্ড প্রথম backend + ৫ সেকেন্ড দ্বিতীয়টা retry)

sudo nano /etc/nginx/conf.d/myapp_alamin.conf     # proxy_read_timeout 5s -> 60s
sudo nginx -t && sudo systemctl reload nginx

time curl http://localhost:30180/slow
#   -> finally, real 0m45.254s
```
📸 `a5-task19-504-then-200.png`

---

# A5 — Task 20 : rate limit

nginx config-এ:
```nginx
limit_req_zone $binary_remote_addr zone=api_alamin:10m rate=5r/s;
...
location /api/notes {
    limit_req zone=api_alamin burst=5 nodelay;
    limit_req_status 429;
    ...
}
```

```bash
echo "$EXAM_TOKEN | $(date)"
for i in $(seq 1 50); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:30180/api/notes
done | sort | uniq -c
#   16 200
#   34 429
```
📸 `a5-task20-rate-limit-429.png`

---

# Evidence file তালিকা

| # | Screenshot | Task |
|---|---|---|
| 1 | `a1-task1-users-groups-perms.png` | A1 Task 1 |
| 2 | `a1-task2-dan-cannot-cat.png` | A1 Task 2 |
| 3 | `a1-task3-carol-cannot-delete.png` | A1 Task 3 |
| 4 | `a1-task4-alice-restart-ok-apt-refused.png` | A1 Task 4 |
| 5 | `a1-proof-table-1-to-12.png` | A1 proof table |
| 6 | `a2-task5-identify-process.png` | A2 Task 5 |
| 7 | `a2-task6-with-without-sudo.png` | A2 Task 6 |
| 8 | `a2-task7-kill-and-free.png` | A2 Task 7 |
| 9 | `a3-task9-pass-and-fail.png` | A3 Task 9 |
| 10 | `a4-task12-service-running.png` | A4 Task 12 |
| 11 | `a4-task13-failed-state.png` | A4 Task 13 |
| 12 | `a4-task13-restart-always.png` | A4 Task 13 |
| 13 | `a4-task14-journalctl-1to5.png` | A4 Task 14 |
| 14 | `a4-task15-watchdog-restart.png` | A4 Task 15 |
| 15 | `a5-task16-whoami-real-ip.png` | A5 Task 16 |
| 16 | `a5-task17-roundrobin-vs-leastconn.png` | A5 Task 17 |
| 17 | `a5-task19-504-then-200.png` | A5 Task 19 |
| 18 | `a5-task20-rate-limit-429.png` | A5 Task 20 |

যেগুলো শেষ করতে পারিনি সেগুলো `INCOMPLETE.md`-এ লেখা আছে।
