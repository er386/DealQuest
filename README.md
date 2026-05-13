# DealQuest

A full-stack web app that helps players find video game deals across major PC stores. Built for IT 340 (Intro to Sys Admin) Section 006 as a 7-week project that simulates a real-world deployment across multiple VMs on a private VLAN.

Live data comes from the free [CheapShark API](https://apidocs.cheapshark.com/). Recommendations are powered by Google Gemini.

## Features

- Search game deals across Steam, Epic Games, GOG, PlayStation Store, Xbox Store, and more
- Personal wishlist with per-game target prices and live price alerts
- Per-game comment threads
- Username + password auth with bcrypt hashing
- Time-based one-time password (TOTP) multi-factor authentication
- Two roles: regular user and admin. Admins can delete any comment, users only their own
- Steam deep link to launch a game directly from a deal card (extra credit)
- Floating AI chat widget that recommends games from your tastes and platforms (extra credit)
- Cron-driven `monitor.sh` on every VM logs requests with timestamps and censors PII

## Architecture

Three Ubuntu VMs on a private VMware LAN segment called `DealQuest-VLAN` (10.0.0.0/24).

```
                 internet
                    |
              [ Web VM 10.0.0.10 ]      nginx serves the Angular build
                    |                   reverse-proxies /api/ to the API VM
                    | (VLAN only)
              [ API VM 10.0.0.11 ]      Node + Express + pm2
                    |                   talks to Mongo over the VLAN
                    | (VLAN only)
              [ DB VM 10.0.0.12  ]      MongoDB 8.0 (auth enabled)
```

UFW restricts inbound traffic on every VM. SSH is not exposed (console access only).

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | Angular 21 (zoneless), TypeScript, signals |
| Backend | Node 20, Express, Mongoose, bcrypt, speakeasy, qrcode |
| Database | MongoDB 8.0 |
| External APIs | CheapShark (deals), Google Gemini 2.5 Flash (chatbot) |
| Hosting | nginx + pm2 across three Ubuntu 25.10 VMs |

## Repo layout

```
DealQuest/
  src/                  Angular app
    app/
      pages/            route components (home, deals, game, wishlist, login, register, account)
      components/       navbar, chat-widget
      services/         auth, wishlist, comments, cheapshark, chat
  server/               Node + Express backend
    routes/             auth, wishlist, comments, chat
    models/             User, Comment
    middleware/         auth (JWT)
  ops/                  monitor.sh and install instructions
  docs/                 project walkthrough and test plan
```

## Quick start (local dev)

Backend:

```
cd server
# create .env with MONGO_URI, JWT_SECRET, CORS_ORIGIN, GEMINI_API_KEY
npm install
node index.js
```

Frontend:

```
npm install
npm start                 # http://localhost:4200
```

For frontend to talk to the backend in dev, either run the backend on the same host or set up an Angular proxy to your API VM. In production this is handled by the nginx reverse proxy on the Web VM.

## Production deploy

```bash
# Web VM
cd ~/DealQuest && git pull
npm run build
sudo systemctl reload nginx

# API VM
cd ~/DealQuest && git pull
pm2 restart dealquest-api
```

See `docs/MILESTONE3-WALKTHROUGH.md` for the full per-VM setup, including UFW rules, MongoDB auth, pm2, nginx, monitor.sh cron, and TOTP MFA.

## Documents

- `docs/MILESTONE3-WALKTHROUGH.md` covers every step taken to build and deploy the project, plus how to test each feature
- `ops/README.md` covers the monitor.sh install steps per VM
