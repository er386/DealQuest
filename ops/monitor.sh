#!/usr/bin/env bash
# DealQuest request/activity monitor.
# Tails a log source, prefixes a timestamp, censors PII, appends to /var/log/dealquest/monitor.log.
# Designed to run from cron every N minutes. Uses a state file to remember byte offset
# so each invocation only processes new lines (handles log rotation by resetting on shrink).
#
# Usage:
#   monitor.sh --source nginx          # web VM: /var/log/nginx/access.log
#   monitor.sh --source pm2            # api VM: ~/.pm2/logs/dealquest-api-out.log
#   monitor.sh --source mongo          # db  VM: /var/log/mongodb/mongod.log
#
# Optional overrides:
#   --input  <path>       custom source file
#   --output <path>       custom output log (default /var/log/dealquest/monitor.log)
#   --state  <path>       custom state file (default /var/lib/dealquest/monitor-<source>.state)

set -euo pipefail

SOURCE=""
INPUT=""
OUTPUT="/var/log/dealquest/monitor.log"
STATE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) SOURCE="$2"; shift 2 ;;
    --input)  INPUT="$2";  shift 2 ;;
    --output) OUTPUT="$2"; shift 2 ;;
    --state)  STATE="$2";  shift 2 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *)
      echo "monitor.sh: unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$SOURCE" ]]; then
  echo "monitor.sh: --source nginx|pm2|mongo is required" >&2
  exit 2
fi

# Resolve default input + state per source
case "$SOURCE" in
  nginx)
    : "${INPUT:=/var/log/nginx/access.log}"
    ;;
  pm2)
    : "${INPUT:=$HOME/.pm2/logs/dealquest-api-out.log}"
    ;;
  mongo)
    : "${INPUT:=/var/log/mongodb/mongod.log}"
    ;;
  *)
    echo "monitor.sh: invalid --source '$SOURCE' (want nginx|pm2|mongo)" >&2
    exit 2
    ;;
esac

: "${STATE:=/var/lib/dealquest/monitor-$SOURCE.state}"

# Ensure parent dirs exist (cron runs unattended; do not assume operator pre-created them)
mkdir -p "$(dirname "$OUTPUT")" "$(dirname "$STATE")"

if [[ ! -r "$INPUT" ]]; then
  echo "monitor.sh: cannot read $INPUT (check perms / source path)" >&2
  exit 1
fi

# --- offset bookkeeping ---------------------------------------------------------
prev_offset=0
if [[ -f "$STATE" ]]; then
  prev_offset=$(cat "$STATE" 2>/dev/null || echo 0)
fi

current_size=$(stat -c %s "$INPUT")

# Log rotated/truncated: file shrank since last run. Start over from byte 0.
if (( current_size < prev_offset )); then
  prev_offset=0
fi

# Nothing new — exit clean.
if (( current_size == prev_offset )); then
  exit 0
fi

# --- PII redaction --------------------------------------------------------------
# Done in a single awk pass so each line is rewritten exactly once.
# Patterns:
#   email             foo@bar.tld         -> f***@bar.tld
#   bearer token      Bearer eyJ...       -> Bearer [REDACTED]
#   JSON password     "password":"x"      -> "password":"[REDACTED]"
#   IPv4 last octet   10.0.0.42           -> 10.0.0.[REDACTED]
HOSTNAME_TAG="$(hostname -s 2>/dev/null || hostname 2>/dev/null || echo unknown)"

TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BYTES=$((current_size - prev_offset))

# Read exactly [prev_offset, current_size) so writes that land mid-run are left
# for the next invocation. `head -c` closing the pipe early would SIGPIPE tail
# and trip pipefail, so disable pipefail just for this stage.
set +o pipefail
tail -c +$((prev_offset + 1)) "$INPUT" | head -c "$BYTES" | gawk -v host="$HOSTNAME_TAG" -v src="$SOURCE" -v ts="$TS" '
{
  line = $0

  # password JSON field (do before email so password values are not picked up as emails)
  line = gensub(/("password"[[:space:]]*:[[:space:]]*)"[^"]*"/, "\\1\"[REDACTED]\"", "g", line)

  # bearer tokens (case-insensitive on the word "bearer")
  line = gensub(/[Bb][Ee][Aa][Rr][Ee][Rr][[:space:]]+[A-Za-z0-9._\-]+/, "Bearer [REDACTED]", "g", line)

  # emails: keep first character + domain so logs are still useful for debugging
  while (match(line, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)) {
    s = substr(line, RSTART, RLENGTH)
    at = index(s, "@")
    masked = substr(s, 1, 1) "***" substr(s, at)
    line = substr(line, 1, RSTART - 1) masked substr(line, RSTART + RLENGTH)
  }

  # IPv4: redact last octet (keep subnet visible for ops triage)
  line = gensub(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)[0-9]{1,3}/, "\\1[REDACTED]", "g", line)

  printf "%s [%s] [%s] %s\n", ts, host, src, line
}
' >> "$OUTPUT"
set -o pipefail

# Persist new offset only after a successful write.
printf '%s' "$current_size" > "$STATE"
