# INCOMPLETE — যা শেষ করতে পারিনি

> সৎভাবে লেখা। যেটা করিনি সেটা লুকালে ০, কিন্তু ঠিকভাবে diagnose করলে ৬০% পাওয়া যায়।

## Scenario A
| Task | অবস্থা | কেন | আমি যতটুকু বুঝেছি |
|---|---|---|---|
| **8** | করিনি | সময় | `<নিজে এক লাইন লেখো>` |
| **10** | করিনি | সময় | `<নিজে এক লাইন লেখো>` |
| **11** | করিনি | সময় | `<নিজে এক লাইন লেখো>` |
| **18** | করিনি | সময় | `<নিজে এক লাইন লেখো>` |

## Scenario B
| Task | অবস্থা | কেন | আমি যতটুকু বুঝেছি |
|---|---|---|---|
| **21, 25** | আংশিক | কাজ হয়েছে, screenshot আছে — শুধু ANSWERS-এ লেখা উত্তর দেইনি | non-root user (`USER node`) আর image-এ secret না থাকা — দুইটাই evidence-এ দেখা যায় |
| **24** — সবচেয়ে বড় layer | করিনি | ২ নম্বরের task, বড়গুলো আগে শেষ করেছি | `docker history --no-trunc` দিয়ে সাজানো যেত। সবচেয়ে বড় layer আমার লেখা লাইনের না — base image-এর `node` binary (~৯৭ MB)। `node_modules` মাত্র ~৫ MB। আরও ছোট করতে হলে distroless লাগত, তাতে debug কঠিন হত |
| **28d** | আংশিক | উত্তর লেখা আছে, screenshot নেওয়া হয়নি | container-এর ভিতরে `127.0.0.1` মানে container-এর নিজের loopback; Docker-এর port forward eth0-তে আসে। তাই `0.0.0.0`-তে listen করাতে হয় |
| **31** | আংশিক | `/api/search`-এ load দেইনি (shared VPS, বাড়তি চাপ দিতে চাইনি); worst-endpoint PromQL চালিয়েছি ট্রাফিক থামার পরে, তাই `NaN` এসেছে | `body`-তে index নাই, তাই search পুরো table scan করত। PromQL load **চলাকালীন** চালাতে হত |
| **33** | আংশিক | rule provision হয়েছে, `Normal` state-এ আছে; `Firing` করাতে পারিনি | concurrency ৮-এ p95 মাত্র ২.১৭s উঠেছে, threshold ৫s। `?limit=200` দিলে এক request-এ ২০১টা query হত, তখন p95 ৫s পার হত। চাপ আরও বাড়ালে উল্টো `/metrics` scrape timeout খেয়ে alert `NoData` হয়ে যেত |
| **42** | আংশিক | cold vs warm duration-এর run list screenshot নেই | cache লেখা (`cache export`) আর পড়া (`importing cache manifest`) দুইটাই log-এ আছে, কিন্তু layer hit হয়নি — কারণ Task 41-এর pipeline plain `docker build` করত, cache export করত না। তাই এই run-টাই cache **বানিয়েছে**, ব্যবহার করতে পারেনি |
| **35–40** (B4 swarm) | এখনো করিনি | সময়ের অভাব, B5 আগে ধরেছি | দুই node-এর swarm plan করা আছে, `stack.yml` লেখা আছে (`replicas: 3`, `order: start-first`, postgres `node.role == manager`-এ bandha কারণ local volume node-এর মধ্যে share হয় না) |
| **43, 44, 45** (B5 বাকি) | এখনো করিনি | সময় | Docker Hub-এ sha + version tag, `production` environment-এ approval gate, আর `docker service update` (rm নয়) — তাই deploy fail করলেও পুরানো replica চলতেই থাকে |

## Scenario C
| Task | অবস্থা | কেন | আমি যতটুকু বুঝেছি |
|---|---|---|---|
| সবগুলো | করিনি | A আর B শেষ করতে সময় চলে গেছে | — |
