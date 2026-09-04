# AI_PROMPTS — AI কোথায় কাজে লেগেছে (bonus 10)

> নিয়ম: শুধু prompt paste করলে ২ নম্বর। "generic উত্তর কী ছিল" আর "আমার
> মেশিনে কী বদলাতে হয়েছে" লিখলে পুরো নম্বর। কমপক্ষে ৮টা entry দরকার।

---

## 1. dan folder দেখবে কিন্তু ফাইল পড়বে না
**যেখানে আটকে ছিলাম:** dan-কে `ls` দিলে `cat`-ও কাজ করে যাচ্ছিল।
**Prompt:** "linux acl: user must be able to ls -l a directory and see filenames but must get permission denied on cat of the file inside. how to set this with setfacl"
**উত্তর যা দিয়েছিল:** `setfacl -R -m u:dan:r-x` পুরো folder-এ recursive দিতে বলেছিল।
**কী ভুল ছিল:** `-R` দেওয়ায় ফাইলের উপরেও ACL বসে গিয়েছিল, তাই dan `cat`-ও করতে পারছিল। আর `ls -l` এ mode-এর পাশে `+` চলে আসছিল, exam-এ চাওয়া output-এর সাথে মিলছিল না।
**যা করে ঠিক হয়েছে:** ACL শুধু **folder**-এ দিয়েছি, ফাইল থেকে `setfacl -b` দিয়ে সব ACL মুছে `chmod 640 root:ops_am` রেখেছি। তখনই `ls` কাজ করে আর `cat` denied দেয়।

---

## 2. carol নিজের folder-এর ফাইল delete করতে পারছিল
**যেখানে আটকে ছিলাম:** sticky bit দেওয়ার পরেও carol `rm` করতে পারছিল।
**Prompt:** "sticky bit on directory but the directory owner can still delete files inside, is that expected?"
**উত্তর যা দিয়েছিল:** প্রথমে বলেছিল sticky bit দিলেই হবে।
**কী ভুল ছিল:** Linux kernel-এ sticky bit **directory-র owner-কে ছাড় দেয়** — আর exam অনুযায়ী folder-এর owner carol নিজেই। তাই কাজ করছিল না।
**যা করে ঠিক হয়েছে:** ফাইলগুলোতে `chattr +i` (immutable) দিয়েছি। এখন `rm` দিলে `Operation not permitted` আসে, কিন্তু নতুন ফাইল লিখতে পারে। `lsattr` দিয়ে প্রমাণ করেছি।

---

## 3. compose-এ app postgres-এর আগে উঠে crash করছিল
**যেখানে আটকে ছিলাম:** `docker compose up` দিলে app `ECONNREFUSED` দিয়ে মরে যাচ্ছিল, অথচ `depends_on` দেওয়া আছে।
**Prompt:** "docker compose depends_on postgres but my node app still crashes with ECONNREFUSED on first start, postgres logs show it is still initializing"
**উত্তর যা দিয়েছিল:** app-এ retry loop বসাতে বলেছিল।
**কী ভুল ছিল:** retry দিলে সমস্যাটা ঢাকা পড়ে, কিন্তু exam-এ প্রমাণ করতে হবে যে `depends_on` **নিজে** যথেষ্ট না।
**যা করে ঠিক হয়েছে:** postgres-এ `healthcheck: pg_isready` আর app-এ `depends_on: condition: service_healthy` দিয়েছি। আর খারাপ version আলাদা ফাইলে (`docker-compose.dependson-only.yml`) রেখে দিয়েছি, যাতে crash-টা screenshot করতে পারি।

## 4. Grafana-তে প্রতিটা note id আলাদা line হয়ে যাচ্ছিল
**যেখানে আটকে ছিলাম:** metric-এ route হিসেবে আসল URL পাঠাচ্ছিলাম।
**Prompt:** "prometheus node express middleware label route with req.path creates thousands of series, how to use route pattern instead"
**উত্তর যা দিয়েছিল:** `req.path` ব্যবহার করতে বলেছিল প্রথমে।
**কী ভুল ছিল:** `/api/notes/48213` এভাবে ৫০ হাজার series হয়ে যেত (high cardinality), Prometheus-এর memory শেষ হয়ে যেত।
**যা করে ঠিক হয়েছে:** `res.on('finish')` এর ভিতরে `req.route.path` নিয়েছি — এতে `/api/notes/:id` আসে, মোট ৭-৮টা series।

## 5. `<এখানে তোমার নিজের entry লেখো>`
**যেখানে আটকে ছিলাম:**
**Prompt:**
**উত্তর যা দিয়েছিল:**
**কী ভুল ছিল:**
**যা করে ঠিক হয়েছে:**

---

## 4.
## 5.
## 6.
## 7.
## 8.
