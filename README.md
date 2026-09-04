# DevOps Practical Exam

**Name:** `Md. Al amin`
**EXAM TOKEN:** `alamin-vmi3536696-1788528499-d41f1787`
**Server IP:** `<এখানে বসাও>`
**GitHub repo:** `<এখানে বসাও>`

## শেয়ার করা server — isolation
এই server-এ একসাথে ৬ জন exam দিচ্ছে। তাই সব user, group, folder, service আর
port-এর নামে আমার prefix (`_alamin`) আর আলাদা port block ব্যবহার করেছি।
পুরো টেবিল: [`scenario-a/ANSWERS.md`](scenario-a/ANSWERS.md) এর শুরুতে।
সব নাম/port এক জায়গায়: [`exam-env.sh`](exam-env.sh)

## Folder
```
exam-env.sh            সব নাম আর port এক জায়গায় (আগে এটা edit করো)
scenario-a/
  RUNBOOK.md           ধাপে ধাপে কী চালাতে হবে (বাংলা)
  ANSWERS.md           লিখিত উত্তর
  configs/             script, systemd unit, nginx conf
  evidence/            screenshot
scenario-b/
  RUNBOOK.md           ধাপে ধাপে গাইড (বাংলা)
  ANSWERS.md           লিখিত উত্তর
  app/                 Notes API (express + pg + prom-client)
  docker/              Dockerfile, compose, prometheus, swarm stack
  grafana/             dashboard.json + datasource provisioning
  scripts/             loadtest, backup/restore, index fix
  evidence/
scenario-c/            (পরে)
```

## Links
- Grafana dashboard: `http://<server-ip>:<GRAF_PORT>` (নাম: `exam-<token>`)
- Prometheus: `http://<server-ip>:<PROM_PORT>`
- GHCR image: `ghcr.io/<user>/notes-api`
- CI pipeline (pass): `<পরে>`
- CI pipeline (fail): `<পরে>`
