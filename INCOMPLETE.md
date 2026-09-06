# INCOMPLETE — যা শেষ করতে পারিনি

> সৎভাবে লেখা। যেটা করিনি সেটা লুকালে ০, কিন্তু ঠিকভাবে diagnose করলে ৬০% পাওয়া যায়।

## Scenario A
| Task | অবস্থা | কেন | আমি যতটুকু বুঝেছি |
|---|---|---|---|
| `<Task নম্বর>` | আংশিক / করিনি | `<কারণ>` | `<যা বুঝেছি লেখো>` |

## Scenario B
| Task | অবস্থা | কেন | আমি যতটুকু বুঝেছি |
|---|---|---|---|
| **24** — সবচেয়ে বড় layer | করিনি | সময় কম ছিল, ২ নম্বরের এই task বাদ দিয়ে বাকি বড় task-গুলো শেষ করেছি | `docker history --no-trunc --format "{{.Size}}\t{{.CreatedBy}}"` দিয়ে layer গুলো size অনুযায়ী সাজানো যেত। আমার image-এ সবচেয়ে বড় layer টা আমার লেখা কোনো লাইনের জন্য না — ওটা base image-এর, alpine-এর ভিতরে `node` binary নিজেই প্রায় ৯৭ MB। `node_modules` (express, pg, prom-client) মাত্র ~৫ MB, আর আমার নিজের code কিলোবাইটের ঘরে। তাই এই layer আরও ছোট করতে হলে base image বদলাতে হত (distroless বা single binary), কিন্তু তাতে container-এ ঢুকে debug করা কঠিন হয়ে যেত।

## Scenario C
| Task | অবস্থা | কেন | আমি যতটুকু বুঝেছি |
|---|---|---|---|
