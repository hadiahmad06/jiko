# Deploying Jiko on an Oracle Cloud always-free VM

The Fly path in `fly.toml` still works. This is the self-hosted alternative that
is actually running: one ARM VM, native packages, systemd. No containers.

**Host:** Oracle Linux 9.8, `aarch64`, 2 cores, 10.9 GB RAM, public IP
`64.181.196.147`. Live at **https://64-181-196-147.sslip.io**.

The box previously shared its RAM with a Minecraft server holding an 8 GB heap.
That server was retired on 2026-09-20 and everything was retuned for a
Jiko-only machine; the history matters only because it explains why the units
carry memory limits at all.

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

## Memory and tuning

Retuned 2026-09-20 once the box became Jiko-only. Postgres was on its install
defaults (128 MB of shared buffers, sized for a machine it was sharing); it now
has real numbers, set with `ALTER SYSTEM` so `ALTER SYSTEM RESET <name>` undoes
any of them:

| | |
| --- | --- |
| `shared_buffers` | 2 GB |
| `effective_cache_size` | 6 GB |
| `maintenance_work_mem` | 512 MB |
| `work_mem` | 16 MB |
| `max_connections` | 50 |
| `random_page_cost` | 1.1 |
| `max_parallel_workers` | 2 (two vCPUs) |

`jiko.service` keeps a limit, raised to `MemoryHigh=1G` / `MemoryMax=2G` in
`/etc/systemd/system/jiko.service.d/jiko-memory.conf` — no longer to protect a
neighbour, just so a runaway process cannot take the machine down. Builds run
under `NODE_OPTIONS=--max-old-space-size=768`.

`vm.swappiness` is 10 and `vm.vfs_cache_pressure` 50
(`/etc/sysctl.d/99-jiko.conf`), so Postgres' buffers stay resident. Swap use
went from 3.5 GB to about 300 MB after the change.

journald is capped at 1 GB with a 30-day retention
(`/etc/systemd/journald.conf.d/99-jiko.conf`): one JSON line per request and
per firing adds up over a multi-day run.

Steady state after the retune: jiko 40 MB, postgres 69 MB, caddy 25 MB, with
10 GB available.

## Backups

`jiko-backup.timer` runs `scripts/backup.sh` nightly into `/opt/jiko/backups`,
keeping 14. `S3_BUCKET` is unset, so dumps are local only — they survive
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

The certificate was issued 2026-09-20 05:12 UTC and runs to 2026-12-19; Caddy
renews it on its own. It needed ingress rules for TCP 80 and 443 in the VCN
security list (the instance firewall alone is not enough) — those are in place.
Because ACME retries on a backoff, a `curl` in the first minute after adding the
rules can still fail; the certificate lands on the next attempt.

`firewalld` now allows only ssh, http and https. The Minecraft ports
(25565/tcp, 24454/udp) were removed on 2026-09-20; re-add with
`sudo firewall-cmd --permanent --add-port=25565/tcp --add-port=24454/udp && sudo firewall-cmd --reload`.

`GET /debug-routes` returns 404 under `NODE_ENV=production`. It reads
`req.app._router`, which Express 5 removed, so on a public URL it was a 500 that
told a stranger the app was broken. `npm run routes` prints the same table.

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
