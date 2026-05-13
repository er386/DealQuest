# DealQuest project walkthrough

This document covers every step taken to build, deploy, and operate DealQuest across three Ubuntu VMs, plus how to test each feature. It is organized in roughly the order things were built.

## Table of contents

1. [Environment](#1-environment)
2. [Milestone 1: front-end completion](#2-milestone-1-front-end-completion)
3. [Milestone 2: authentication and VLAN](#3-milestone-2-authentication-and-vlan)
4. [Milestone 3: full functionality](#4-milestone-3-full-functionality)
5. [Logging and monitoring (monitor.sh)](#5-logging-and-monitoring-monitorsh)
6. [Firewall (UFW)](#6-firewall-ufw)
7. [Deployment cheat sheet](#7-deployment-cheat-sheet)
8. [Testing each feature end-to-end](#8-testing-each-feature-end-to-end)
9. [Admin operations](#9-admin-operations)

---

## 1. Environment

### Hosts

| Role | Hostname | VLAN IP | NAT IP (when applicable) | OS |
| --- | --- | --- | --- | --- |
| Web | dealquest-web | 10.0.0.10 | 192.168.37.134 | Ubuntu 25.10 |
| API | dealquest-api | 10.0.0.11 | NAT for git pull | Ubuntu 25.10 |
| DB | dealquest-db | 10.0.0.12 | (NAT disconnected for spec) | Ubuntu 25.10 |

All three VMs share a VMware LAN Segment called `DealQuest-VLAN` (10.0.0.0/24). The Web VM is the only VM intended to receive inbound traffic from outside the VLAN.

### Tools installed

- Web VM: nginx, Node 20, gawk
- API VM: Node 20, pm2, git, gawk
- DB VM: MongoDB 8.0 (native install, not Docker, per course requirement), gawk

---

## 2. Milestone 1: front-end completion

**Goal:** Login, Register, and Home pages built with HTML and CSS, hosted on at least one VM.

### What was done

- Scaffolded an Angular 21 project (zoneless mode).
- Built `home`, `login`, and `register` routes with the dark purple theme (`--bg #0f0f13`, `--surface #1a1a24`, `--accent #7c6af7`).
- Built and copied the static output to nginx on the Web VM.

### How to test

1. Open `http://192.168.37.134/` in a browser.
2. Click "Sign Up" in the navbar. Register form loads.
3. Click "Sign In". Login form loads.

---

## 3. Milestone 2: authentication and VLAN

**Goal:** Working sign-up/sign-in, three VMs on a VLAN, password hashing, UFW, no SQL injection vectors.

### Backend skeleton

- `server/index.js`: Express app with `helmet`, `cors`, and `express.json({ limit: '10kb' })` middleware. Mounts `/api/auth`, `/api/wishlist`, `/api/comments`, `/api/chat`.
- `server/db.js`: Mongoose `connect(process.env.MONGO_URI)`.
- `server/models/User.js`: Mongoose schema with `username`, `passwordHash`, `role`, `mfaEnabled`, `mfaSecret` (select:false), `wishlist[]`.
- `server/middleware/auth.js`: JWT Bearer verifier. Reads `Authorization: Bearer <token>`, sets `req.userId` and `req.role`. Exports `requireAdmin` for admin-only routes.
- `server/routes/auth.js`: `POST /register`, `POST /login`, plus MFA endpoints (covered below).

### Password hashing

bcrypt with 10 salt rounds in the register route. The plaintext password never leaves the request handler.

### VLAN setup in VMware

1. VMware Workstation > Edit > Virtual Network Editor.
2. Created a LAN Segment named `DealQuest-VLAN`.
3. Attached a network adapter on each of the three VMs to that segment.
4. Configured static IPs via netplan on each VM (10.0.0.10, 10.0.0.11, 10.0.0.12).

### MongoDB setup on the DB VM

```bash
# Installed from MongoDB's official repo
sudo apt-get install -y mongodb-org

# /etc/mongod.conf was written atomically via individual echo commands
# (heredoc/sed mangled YAML indent), then:
sudo systemctl enable --now mongod

# Created users
mongosh
> use admin
> db.createUser({ user: 'admin', pwd: '<adminpw>', roles: ['root'] })
> use dealquest
> db.createUser({ user: 'dealquest', pwd: '<apppw>', roles: [{ role: 'readWrite', db: 'dealquest' }] })
```

`/etc/mongod.conf` was set to:
```
net:
  port: 27017
  bindIp: 127.0.0.1,10.0.0.12
security:
  authorization: enabled
```

### API VM setup

```bash
sudo apt-get install -y nodejs npm git
sudo npm install -g pm2

cd ~
git clone https://github.com/er386/DealQuest.git
cd DealQuest/server
npm install

# Created server/.env with:
#   MONGO_URI=mongodb://dealquest:<apppw>@10.0.0.12:27017/dealquest
#   JWT_SECRET=<random 64 chars>
#   CORS_ORIGIN=http://10.0.0.10
#   GEMINI_API_KEY=<Google AI Studio key>
#   PORT=3000

pm2 start index.js --name dealquest-api
pm2 startup systemd
pm2 save
```

### Web VM setup

```bash
sudo apt-get install -y nginx nodejs npm

cd ~
git clone https://github.com/er386/DealQuest.git
cd DealQuest
npm install
npm run build
```

`/etc/nginx/sites-available/dealquest`:
```
server {
    listen 80 default_server;
    root /home/ethan/DealQuest/dist/dealquest-ng/browser;

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    location /api/ {
        proxy_pass http://10.0.0.11:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/dealquest /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

### How to test Milestone 2

1. Visit `http://192.168.37.134/register`. Create an account.
2. Open the DB VM mongo shell and verify the user document exists with a `passwordHash` (not the plaintext password).
   ```
   mongosh -u dealquest -p --authenticationDatabase dealquest
   use dealquest
   db.users.findOne({}, { username: 1, passwordHash: 1 })
   ```
3. Sign in with the same credentials. The navbar shows your username.
4. Open browser devtools > Application > Local Storage. A `token` and `username` are present.

---

## 4. Milestone 3: full functionality

**Goal:** Game deal search, wishlist, target price alerts, two roles, comments, MFA, plus the rest of the rubric.

Built in daily slices.

### Day 1: game deal search via CheapShark

- `src/app/services/cheapshark.service.ts` wraps the free CheapShark REST API: `getStores()`, `getDeals(query)`, `getGame(gameID)`. Stores are cached with `shareReplay(1)` so the store name map is fetched once per session.
- `home` page shows two sections (Featured Deals by Deal Rating, Top Picks by Savings) plus a hero search bar and tag chips. Tag chips and search both navigate to `/deals?q=<term>`.
- `deals` page: live search with a 350 ms debounce, price-tier filter chips (Free/Under $5/etc.), store filter dropdown, sort dropdown. The search input also reads `?q=` on first load.
- Because Angular 21 is zoneless, every async field on these components had to be a `signal()` rather than a plain class property. Subscribing to `HttpClient` and assigning to a property does not re-render in zoneless mode. See `project_dealquest_zoneless.md` for the full pattern.

### Day 2: wishlist

- `server/models/User.js`: added a `wishlist[]` subdoc array (`gameID`, `dealID`, `title`, `thumb`, `storeID`, `salePrice`, `normalPrice`, `targetPrice`, `savedAt`).
- `server/routes/wishlist.js`: GET/POST/DELETE/PATCH gated by JWT.
- `src/app/services/wishlist.service.ts`: signal-based item list. `add`, `remove`, `has`, `load`, `clear`. Auth header pulls token from localStorage.
- `pages/wishlist/wishlist.{ts,html,css}`: real data, replaces the original mocked rows. Heart button on the home and deals pages now reflects saved state.

### Day 3: target price alerts + navbar auth state

- `PATCH /api/wishlist/:gameID` accepts `{ targetPrice: number | null }`.
- On the wishlist page, each row pulls a live current price from CheapShark via `getGame(gameID)`. `effectivePrice()` prefers live over stored.
- Inline edit state via two signals: `editingTarget` and `targetInput`. The input is `type="text" inputmode="decimal"` so Angular's `ngModel` emits a string (an early bug was that `type="number"` emitted a number and `.trim()` then threw silently).
- "Target hit!" badge with a pulsing dot when `effectivePrice <= targetPrice`. Row gets a green border via `[class.deal-met]`.
- Navbar: `AuthService` now exposes `username = signal<string|null>` and `isLoggedIn = computed(...)`. The navbar shows a user pill with a dropdown (`My Wishlist`, `Account & Security`, `Sign Out`) when logged in.

### Day 4: user roles

- `User.js` gained `role: { enum: ['user','admin'], default: 'user' }`.
- Register/login JWT payloads include `role`. Register explicitly sets `role: 'user'` so a client cannot elevate.
- `middleware/auth.js`: exposes `req.role`. Also exports a `requireAdmin` helper attached to the default middleware function.
- `AuthService` exposes a `role` signal and `isAdmin = computed(...)`. Role is persisted to localStorage alongside the username.
- Navbar shows a purple "Admin" pill next to the username chip when `auth.isAdmin()`.

### Day 5: comment system

- `server/models/Comment.js`: `gameID` (indexed), `userId` ref, `username` snapshot, `body` (max 1000 chars), timestamps.
- `server/routes/comments.js`: GET `?gameID=` is public, POST requires auth, DELETE `/:id` allowed if owner or admin.
- `pages/game/game.{ts,html,css}` at route `/games/:gameID` shows the CheapShark game info (thumb, title, cheapest-ever), the deal list with savings percentages, a wishlist toggle, and the comment thread.
- Deal cards on home, deals, and wishlist now navigate to `/games/:gameID` instead of opening CheapShark's redirect directly. The "Get deal" button lives inside the game detail page.

### Day 5b: TOTP MFA

- New deps: `speakeasy` (TOTP) and `qrcode` (QR data URL).
- `User.js`: added `mfaEnabled` (bool) and `mfaSecret` (string, `select:false`).
- New routes:
  - `POST /api/auth/mfa/setup` (auth): generates a base32 secret, returns a QR data URL.
  - `POST /api/auth/mfa/enable` (auth): verifies a code, flips `mfaEnabled=true`.
  - `POST /api/auth/mfa/disable` (auth): requires current code to disarm.
  - `GET /api/auth/mfa/status` (auth): returns `{ mfaEnabled }`.
  - `POST /api/auth/login` now returns `{ mfaRequired: true, mfaToken }` (a 5-minute JWT with `mfa: 'pending'`) when MFA is enabled, instead of the full session.
  - `POST /api/auth/login/mfa` exchanges `mfaToken + code` for the real session JWT.
- `speakeasy.totp.verify` is called with `window: 1` so the previous and next 30-second codes are accepted (handles clock skew between server and authenticator).
- New `/account` page shows status, enable flow (QR + secret + verify code), and disable flow (code confirm).
- Login page becomes two-step when MFA is required: after username/password, a 6-digit code input appears with a "Use a different account" escape hatch.

### Day 6 extras: Steam deep link and AI chatbot

- Steam deep link: when a `/games/:gameID` deal row has `storeID === '1'` (Steam) and CheapShark returned a `steamAppID`, a "Steam" launch button appears next to "Get deal". Link target is `steam://run/<appid>` so Steam launches the game if the user owns it, or falls back to the store page if they don't.
- AI chatbot:
  - `server/routes/chat.js`: POST `/api/chat` with `{ messages: [{role, content}, ...] }`. Forwards to `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`. System prompt steers the model to suggest 3 to 5 specific games and tell the user to look them up on `/deals`. `thinkingConfig.thinkingBudget: 0` is set because Gemini 2.5 Flash spends silent thinking tokens against the output budget, which was clipping replies.
  - `src/app/services/chat.service.ts` is a singleton (`providedIn: 'root'`) holding the message signal and persisting it to localStorage so conversations survive navigation and refresh.
  - `src/app/components/chat-widget`: a floating launcher pinned to the bottom-right of every page. Click to open a 380 by 560 pixel panel. State lives in the service so closing and reopening keeps history. "Clear" wipes the conversation.

---

## 5. Logging and monitoring (monitor.sh)

`ops/monitor.sh` is a cron-driven bash script that tails the relevant log file on each VM, prefixes a UTC timestamp + host tag + source tag, censors PII, and appends to `/var/log/dealquest/monitor.log`.

### What it does

- `--source nginx|pm2|mongo`: picks the input file (nginx access log on Web, pm2 out log on API, mongod log on DB).
- Tracks byte offset per source in `/var/lib/dealquest/monitor-<source>.state` so each run processes only new lines. Resets to 0 if the file shrank (log rotation).
- Reads exactly `[prev_offset, current_size)` via `tail -c +N | head -c M` so writes that land mid-run are left for the next invocation.
- One `gawk` pass redacts:
  - `"password":"..."` JSON fields become `"password":"[REDACTED]"`.
  - Bearer tokens become `Bearer [REDACTED]`.
  - Emails like `foo@bar.tld` become `f***@bar.tld`.
  - IPv4 addresses have their last octet replaced with `[REDACTED]`.

### Install per VM

Detailed steps live in `ops/README.md`. Summary:

1. `sudo apt-get install -y gawk`
2. `sudo mkdir -p /var/log/dealquest /var/lib/dealquest && sudo chown $USER:$USER /var/log/dealquest /var/lib/dealquest`
3. Make the script executable.
4. `crontab -e` and add the per-source line:

```
*/5 * * * * /home/ethan/DealQuest/ops/monitor.sh --source nginx >> /var/log/dealquest/monitor.err 2>&1
*/5 * * * * /home/ethan/DealQuest/ops/monitor.sh --source pm2   >> /var/log/dealquest/monitor.err 2>&1
*/5 * * * * /home/ethan/DealQuest/ops/monitor.sh --source mongo >> /var/log/dealquest/monitor.err 2>&1
```

### How to test

On any VM:

```bash
~/DealQuest/ops/monitor.sh --source <nginx|pm2|mongo>
tail -n 20 /var/log/dealquest/monitor.log
```

Output should look like:

```
2026-05-13T03:42:33Z [dealquest-web] [nginx] 192.168.37.[REDACTED] - - [12/May/2026:18:04:19 +0000] "POST /api/auth/register HTTP/1.1" 201 0 "{\"email\":\"e***@example.com\",\"password\":\"[REDACTED]\"}" ...
```

To force a real redaction test on the API VM, hit `POST /api/auth/login` with a fake password and look for `"password":"[REDACTED]"` in the next monitor.log entry.

---

## 6. Firewall (UFW)

UFW is enabled on every VM. Only the ports needed for the architecture diagram are open.

### Web VM (10.0.0.10)

```
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw enable
```

### API VM (10.0.0.11)

```
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.0.0.10 to any port 3000 proto tcp
sudo ufw enable
```

### DB VM (10.0.0.12)

```
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 10.0.0.11 to any port 27017 proto tcp
sudo ufw enable
```

### How to test

On each VM:

```bash
sudo ufw status verbose
```

From the Web VM (which should not have direct DB access), confirm it cannot reach Mongo:

```bash
nc -zv 10.0.0.12 27017     # should fail (timeout) because UFW on the DB VM blocks Web
```

From the API VM:

```bash
nc -zv 10.0.0.12 27017     # should succeed
```

---

## 7. Deployment cheat sheet

After pulling new code into the repo:

```bash
# API VM
cd ~/DealQuest && git pull
pm2 restart dealquest-api
pm2 logs dealquest-api --lines 20

# Web VM
cd ~/DealQuest && git pull
npm run build
sudo systemctl reload nginx
```

For backend-only changes you only need the API VM. For frontend-only changes you only need the Web VM. The DB VM is rebuilt manually only when the schema changes (rare).

---

## 8. Testing each feature end-to-end

All testing happens at `http://192.168.37.134/` from a browser on the host laptop.

### 8.1 Register and log in

1. Click Sign Up. Pick a username and password (min 6 chars).
2. Form submits, navbar updates to show your username.
3. Click the username chip, Sign Out, then Sign In with the same credentials. Confirms login works.

### 8.2 Game deal search

1. Click Deals in the navbar.
2. Type a game name in the search box (for example, `hades`). Results update after a short pause (350 ms debounce).
3. Switch the sort dropdown to "Savings". Order changes.
4. Click a price-tier chip (for example, "Under $5"). Results filter.

### 8.3 Wishlist

1. From any deal card, click the heart icon. If not logged in, you are redirected to Login.
2. Once logged in, click the heart on a few games.
3. Click Wishlist in the navbar. Saved games appear with their stored sale price and a live-refreshed current price.
4. Click "Set target price" on a row, enter a number lower than the current price, hit Save. The row now shows a "Target hit!" badge with a green border.
5. Click the heart icon again on a saved game (from anywhere). It is removed from the wishlist.

### 8.4 Comments

1. From the wishlist or deals page, click a card to open `/games/<gameID>`.
2. Scroll to Comments. While logged in, type a message and click Post comment.
3. The new comment appears at the top with your username and "now" timestamp.
4. Click the ✕ next to your comment. Confirm. Comment disappears.

### 8.5 TOTP MFA enable + login

1. Click your username chip in the navbar > Account & Security.
2. Click Enable MFA. A QR code appears.
3. Scan the QR code in Google Authenticator (or any TOTP app).
4. Type the 6-digit code shown in the app, click Verify and enable. Status now shows MFA enabled.
5. Sign out.
6. Sign back in with username/password. After clicking Sign In, the form switches to a code prompt. Enter the current TOTP code and submit. You are signed in.

### 8.6 Steam deep link

1. Open any game detail page with a Steam deal (most popular games on CheapShark have a Steam entry, storeID 1).
2. A "Steam" button appears alongside "Get deal" in the Steam deal row.
3. Click it. The browser prompts to open Steam. If Steam is installed and you own the game, it launches. Otherwise it opens the Steam store page for that title.

### 8.7 AI chatbot

1. Click the purple chat bubble in the bottom-right of any page.
2. The panel slides up. Click a suggestion chip or type a prompt like "Recommend cozy puzzle games on Switch".
3. The assistant returns 3 to 5 recommendations as a bulleted list and ends with "Search any of these on the Deals page to find current prices."
4. Close the panel and reopen it. Conversation is still there.
5. Refresh the whole page. Conversation is still there (persisted in localStorage).
6. Click Clear in the panel. Conversation is wiped.

### 8.8 monitor.sh

On each VM:

```bash
tail -n 20 /var/log/dealquest/monitor.log
```

Should show timestamped entries with all four redaction types visible. To force a fresh entry, run the script manually:

```bash
~/DealQuest/ops/monitor.sh --source <nginx|pm2|mongo>
```

### 8.9 UFW

On each VM:

```bash
sudo ufw status verbose
```

Web VM allows 80/tcp from anywhere. API VM allows 3000/tcp only from 10.0.0.10. DB VM allows 27017/tcp only from 10.0.0.11.

---

## 9. Admin operations

### Promote a user to admin

On the DB VM:

```bash
mongosh -u admin -p --authenticationDatabase admin
use dealquest
db.users.updateOne({ username: 'ethan' }, { $set: { role: 'admin' } })
db.users.findOne({ username: 'ethan' }, { username: 1, role: 1 })
exit
```

The promoted user must sign out and back in for a fresh JWT with the updated `role` claim.

### What admins can do

- The navbar shows a purple "Admin" pill next to their username.
- On every comment thread, the ✕ delete button is visible on every comment (regular users only see ✕ on their own). The button shows a "Delete as admin" tooltip on comments authored by others.
- Backend enforces it in `routes/comments.js`: `isOwner || isAdmin`.

### Rotate the JWT secret

If the JWT secret leaks, edit `server/.env` on the API VM and restart pm2:

```bash
pm2 restart dealquest-api
```

All existing tokens become invalid and every user must sign back in.

### Reset monitor.sh state

```bash
rm /var/lib/dealquest/monitor-*.state
> /var/log/dealquest/monitor.log
```

Next cron run processes the full source log from scratch.
