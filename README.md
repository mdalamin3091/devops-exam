# DevOps Practical Exam — Md. Al amin

**EXAM TOKEN:** `alamin-vmi3536696-1788528499-d41f1787`
**Server:** `169.58.246.108` (Contabo VPS `vmi3536696`, Ubuntu)
**Repo:** https://github.com/mdalamin3091/devops-exam

Every screenshot in `evidence/` was taken after running:

```bash
echo "$EXAM_TOKEN | $(date)"
```

---

## Shared server — how I kept my work separate

Six students are doing this exam on the **same VPS** and the **same Docker daemon**.
If everyone used `alice`, `/srv/app`, `myapp.service` and port `3001`, one person's
work would overwrite another's. So every name I created ends with `_alamin`, and I
took a fixed port block.

| Exam says | I used |
|---|---|
| alice, bob, carol, dan | `alice_alamin`, `bob_alamin`, `carol_alamin`, `dan_alamin` |
| devs, ops, auditor | `devs_alamin`, `ops_alamin`, `auditor_alamin` |
| `/srv/app` | `/srv/app_alamin` |
| `myapp.service` | `myapp_alamin.service`, `myapp2_alamin.service` |
| `myappuser` | `myappuser_alamin` |
| app ports 3001 / 3002 | **30101 / 30102** |
| nginx port 80 | **30180** |
| ports 8080 / 9090 (A2) | **30108 / 30109** |
| `/var/log/healthcheck.log` | `/var/log/healthcheck_alamin.log` |
| docker app / prometheus / grafana | **30103 / 30190 / 30191** |
| swarm published port | **30104** |

Two details that matter and are easy to miss:

- In nginx, `upstream` and `limit_req_zone` names are **global across all of
  `conf.d/`**. Two students using `upstream backend` would break `nginx -t` for
  everyone. Mine are `backend_alamin` and `api_alamin`.
- The sudo rule went into `/etc/sudoers.d/myapp_alamin`, written to a temp file and
  checked with `visudo -c -f` **before** installing it. A syntax error directly in
  `/etc/sudoers` would remove sudo for all six of us.

Swarm is also one per host, so I checked `docker info` before touching it and never
ran `docker swarm leave --force` or `docker system prune -a`.

---

## Repository layout

```
README.md            this file
ANSWERS              scenario-a/ANSWERS.md, scenario-b/ANSWERS.md
AI_PROMPTS.md        where AI helped, and what it got wrong
TIMELINE.md          work diary
INCOMPLETE.md        what I did not finish, and how far I got
exam-env.sh          all my names and ports in one place

scenario-a/
  ANSWERS.md         written answers
  configs/           nginx conf, systemd units, watchdog, healthcheck.sh,
                     commands-run.md (every command I ran, mapped to screenshots)
  evidence/          screenshots

scenario-b/
  ANSWERS.md
  app/               Notes API (Express + Postgres + prom-client)
  docker/            Dockerfile, .dockerignore
  evidence/

scenario-c/
```

---

## Status

| Scenario | State |
|---|---|
| A — inherited server | Done except tasks 8, 10, 11 and 18 — see `INCOMPLETE.md` |
| B — containerize and observe | In progress (Task 21) |
| C | Not started |

`scenario-a/configs/commands-run.md` lists the exact commands behind each
screenshot, so every image in `evidence/` can be traced back to what I typed.

---

## Notes for the checker

- No `.env`, key or password is committed. Verify with:
  ```bash
  git ls-files | grep -E '\.env$'
  git log --all --diff-filter=A --name-only | grep -E '\.env$'
  ```
  Both return nothing — the file was never added, not even in an earlier commit.
- No `chmod 777` anywhere, no `--privileged` container.
- The db password in `/srv/app_alamin/secrets/db-password.txt` is a fake value used
  only to demonstrate the ACL behaviour in A1.

---

## Links

| What | Where |
|---|---|
| nginx through reverse proxy | `http://169.58.246.108:30180/` |
| app backend 1 / 2 | ports 30101 / 30102 (local only, firewall closed) |
| Prometheus | `http://169.58.246.108:30190` |
| Grafana | `http://169.58.246.108:30191` |
| Container image | `ghcr.io/mdalamin3091/notes-api` |
