# Deploying Jiko on an Oracle Cloud always-free VM

The Fly path in `fly.toml` still works. This is the self-hosted alternative that
is actually running: one ARM VM, native packages, systemd. No containers.

**Host:** Oracle Linux 9.8, `aarch64`, 2 cores, 10.9 GB RAM, public IP
`64.181.196.147`. The box is shared with a Minecraft server holding an 8 GB
heap, which is why everything here is memory-capped.

## What is installed

| Piece | Version | How |
| --- | --- | --- |
| Node | 22.23.2 | `dnf module enable nodejs:22` |
| PostgreSQL | 16.15 | PGDG repo (`pgdg16`) |
| PostGIS | 3.4.6 | `postgis34_16`, needs EPEL + CodeReady Builder for `hdf5`/`xerces-c` |
| Caddy | 2.11.4 | `@caddy/caddy` COPR, terminates TLS and reverse-proxies to `:3000` |

The Oracle Linux appstream only carries PostgreSQL 13, which is out of support,
so the PGDG repo is added instead. PostGIS is a hard requirement: the baseline
migration creates `GEOGRAPHY(POINT, 4326)` on `locations`.

## Layout

```
/opt/jiko/jiko.env        secrets + config, root:jiko 0640, read by systemd
/opt/jiko/app             the contents of this repo's backend/
/opt/jiko/backups         nightly dumps, 14 kept
/opt/jiko/deploy.sh       rebuild + migrate + restart
/etc/caddy/Caddyfile      TLS + reverse proxy
```

Units: `jiko.service` (the API), `jiko-migrate.service` (one-shot, run by the
deploy script), `jiko-backup.service` + `.timer` (nightly 03:30 UTC),
`postgresql-16.service`, `caddy.service`. All enabled at boot.

## Deploying a change

From this directory:

```bash
rsync -az --delete --rsync-path="sudo rsync" \
  --exclude node_modules --exclude dist --exclude .git --exclude .env \
  ./ oracle-cloud:/opt/jiko/app/
ssh oracle-cloud /opt/jiko/deploy.sh
```

`deploy.sh` runs `npm ci`, `npm run build`, `systemctl start jiko-migrate`,
restarts the service and curls `/health`. Migrations run through a systemd
one-shot rather than an inline `env` call so `DATABASE_URL` never appears in
`ps`.

## Memory

`jiko.service` sets `MemoryHigh=384M` / `MemoryMax=768M`, and builds run under
`NODE_OPTIONS=--max-old-space-size=768`. The neighbouring JVM is started with
`-Xms8G -Xmx8G` on a 10.9 GB box, so the machine lives close to its swap. The
caps mean a leak in Jiko gets Jiko OOM-killed instead of the Minecraft server.

Steady state measured after a restart: jiko 38 MB, postgres 131 MB, caddy 24 MB.

## Backups

`jiko-backup.timer` runs `scripts/backup.sh` nightly into `/opt/jiko/backups`,
keeping 14. `BACKUP_S3_BUCKET` is unset, so dumps are local only — they survive
a bad migration, not a lost instance. Set `S3_BUCKET` in `/opt/jiko/jiko.env`
and give the box credentials to change that.

### Restoring

Run the restore **as the `postgres` superuser**, not as `jiko`:

```bash
sudo cp /opt/jiko/backups/jiko-<stamp>.dump /tmp/r.dump
sudo cp /opt/jiko/app/scripts/restore.sh /tmp/r.sh
sudo chown postgres /tmp/r.dump /tmp/r.sh && sudo chmod 755 /tmp/r.sh
sudo -u postgres env PATH=/usr/pgsql-16/bin:/usr/bin:/bin \
  /tmp/r.sh /tmp/r.dump "postgres:///jiko_restore_test"
```

A dump taken from a database whose `postgis` and `pgcrypto` extensions are owned
by `postgres` carries `DROP EXTENSION` and `COMMENT ON EXTENSION` lines that only
the owner may run, plus a `COPY` into `spatial_ref_sys`. Restoring as `jiko`
fails all five and `set -e` in `restore.sh` then kills the script before it
verifies anything — it looks like the dump is bad when it is not. The two `/tmp`
copies are because `/opt/jiko` is `0750 jiko:jiko` and `postgres` cannot traverse it.

Rehearsed 2026-09-20: 18 tables, 4 migrations, no errors.

## TLS

`/etc/caddy/Caddyfile` serves `64-181-196-147.sslip.io`. `sslip.io` resolves any
`<dashed-ip>.sslip.io` to that IP, so Let's Encrypt can issue a real certificate
without owning a domain — which the iOS agent needs, since App Transport
Security refuses plain HTTP. Point the hostname at your own domain when you have
one; it is the only line to change.

**The certificate is not issued yet.** Both ACME challenges fail with "Timeout
during connect": the instance firewall allows 80 and 443, but the VCN security
list in the OCI console does not. Caddy retries for up to 30 days, so the
certificate appears on its own once the ingress rules exist — nothing to re-run.

### The one manual step

In the OCI console: **Networking → Virtual Cloud Networks → your VCN → Security
Lists → the default list → Add Ingress Rules**, twice —

| Source | Protocol | Destination port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | 80 |
| `0.0.0.0/0` | TCP | 443 |

Then `curl https://64-181-196-147.sslip.io/health` from anywhere.

## Pointing the agents at it

Both agents read `jiko.baseURL` from `UserDefaults`
(`apple/JikoKit/Sources/JikoKit/JikoAPI.swift`), settable in each app's Settings
screen. Set it to `https://64-181-196-147.sslip.io` — no rebuild needed.

## Checks

```bash
ssh oracle-cloud 'systemctl is-active jiko postgresql-16 caddy'
ssh oracle-cloud 'curl -s localhost:3000/health'
ssh oracle-cloud 'sudo journalctl -u jiko -f'                      # structured logs
ssh oracle-cloud 'sudo journalctl -u jiko | jq "select(.event==\"firing\")"'
ssh oracle-cloud 'systemctl list-timers jiko-backup'
```
