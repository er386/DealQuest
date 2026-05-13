# DealQuest ops scripts

## monitor.sh

Cron-driven request/activity monitor. Tails the relevant log source on each VM,
prefixes every line with a UTC timestamp + host tag + source tag, censors PII,
and appends to `/var/log/dealquest/monitor.log`.

PII censored:
- emails (`foo@bar.tld` → `f***@bar.tld`)
- bearer tokens (`Bearer eyJ...` → `Bearer [REDACTED]`)
- JSON password fields (`"password":"..."` → `"password":"[REDACTED]"`)
- IPv4 last octet (`10.0.0.42` → `10.0.0.[REDACTED]`)

State is kept per source in `/var/lib/dealquest/monitor-<source>.state` (byte
offset into the source file). On log rotation the offset resets automatically.

### Prereqs (all VMs)

```bash
sudo apt-get update && sudo apt-get install -y gawk
sudo mkdir -p /var/log/dealquest /var/lib/dealquest
sudo chown $USER:$USER /var/log/dealquest /var/lib/dealquest
chmod +x ~/DealQuest/ops/monitor.sh
```

### Web VM (10.0.0.10) — nginx access log

Nginx access log is root-owned but world-readable on Ubuntu by default; if not:

```bash
sudo chmod a+r /var/log/nginx/access.log
```

Cron (every 5 minutes):

```bash
crontab -e
# add:
*/5 * * * * /home/ethan/DealQuest/ops/monitor.sh --source nginx >> /var/log/dealquest/monitor.err 2>&1
```

### API VM (10.0.0.11) — pm2 out log

```bash
crontab -e
# add:
*/5 * * * * /home/ethan/DealQuest/ops/monitor.sh --source pm2 >> /var/log/dealquest/monitor.err 2>&1
```

If the pm2 log path is not the default, override with `--input`:

```
*/5 * * * * /home/ethan/DealQuest/ops/monitor.sh --source pm2 --input /home/ethan/.pm2/logs/dealquest-api-out.log >> /var/log/dealquest/monitor.err 2>&1
```

### DB VM (10.0.0.12) — mongod log

```bash
sudo chmod a+r /var/log/mongodb/mongod.log
crontab -e
# add:
*/5 * * * * /home/ethan/DealQuest/ops/monitor.sh --source mongo >> /var/log/dealquest/monitor.err 2>&1
```

### Verify

```bash
# trigger a few requests from your laptop, then on each VM:
tail -n 20 /var/log/dealquest/monitor.log

# force an immediate run (don't wait for cron):
~/DealQuest/ops/monitor.sh --source nginx     # or pm2 / mongo
```

Lines look like:

```
2026-05-12T18:04:21Z [dealquest-web] [nginx] 192.168.37.[REDACTED] - - [12/May/2026:18:04:18 +0000] "POST /api/auth/login HTTP/1.1" 200 312 "-" "Mozilla/5.0 ..."
```

### Reset state (for demos)

```bash
rm /var/lib/dealquest/monitor-*.state
> /var/log/dealquest/monitor.log
```
