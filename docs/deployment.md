# Production deployment

One VPS in Singapore runs everything: Caddy serves the POS app and proxies the API, Django runs behind it with Postgres and Redis. The app and the API share one address (e.g. `https://pos.yicipang.id`), so the PWA, the refresh cookie, the customer display and the print agent all work with a single origin.

```
Cashier PC / tablets / owner's phone ──HTTPS + WSS──▶ Caddy (pos-web: React app, TLS) ──▶ Django (pos-api) ──▶ Postgres, Redis
                                                                                              │
                                                 nightly backup-postgres.sh ──▶ backups/ + off-site bucket (R2 / B2 / Spaces)
GitHub push to main ──▶ CI tests ──▶ builds pos-api + pos-web images (GHCR) ──▶ SSH: pull + restart on the VPS
```

## 1. The server (once)

1. Create a VPS: **Singapore**, Ubuntu 24.04, **2 vCPU / 4 GB RAM / 40 GB+ disk** (DigitalOcean SGP1, Tencent Lighthouse Singapore or similar). Turn on the provider's weekly snapshots if offered.
2. DNS: an **A record** for the POS hostname (e.g. `pos.yicipang.id`) pointing at the server's IP.
3. On the server, as root:

   ```bash
   adduser --disabled-password --gecos "" deploy
   usermod -aG sudo deploy
   curl -fsSL https://get.docker.com | sh
   usermod -aG docker deploy
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
   ```

   Add your SSH public key to `/home/deploy/.ssh/authorized_keys`, then set `PasswordAuthentication no` in `/etc/ssh/sshd_config` and `systemctl restart ssh`. Don't install nginx or certbot: Caddy owns ports 80/443 and the certificate.

4. As `deploy`, clone the repository with a **read-only deploy key** (GitHub → repository → Settings → Deploy keys):

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/github -N ""     # add ~/.ssh/github.pub as a read-only deploy key
   printf 'Host github.com\n  IdentityFile ~/.ssh/github\n' >> ~/.ssh/config
   sudo mkdir -p /srv/pos-system && sudo chown deploy: /srv/pos-system
   git clone git@github.com:trixyncid/pos-system.git /srv/pos-system
   mkdir -p /srv/pos-system/backend/logs
   ```

## 2. The `.env` file (once)

`/srv/pos-system/backend/.env`, from `.env.example`:

| Setting | Value |
|---|---|
| `SECRET_KEY` | `python3 -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DEBUG` | `0` |
| `ALLOWED_HOSTS` | the hostname, e.g. `pos.yicipang.id` |
| `DOMAIN` | the same hostname |
| `FRONTEND_URL` | `https://` + the hostname |
| `ACME_EMAIL` | an address that hears about certificate problems |
| `TIME_ZONE` | `Asia/Makassar` |
| `SQL_PASSWORD` | a long random value (`openssl rand -hex 24`) |
| `APP_IMAGE` | `ghcr.io/trixyncid/pos-api:latest` |
| `WEB_IMAGE` | `ghcr.io/trixyncid/pos-web:latest` |
| `BACKUP_S3_*` | the off-site bucket (section 5) |
| `SENTRY_DSN` | optional: errors emailed to you |

`APP_IMAGE` and `WEB_IMAGE` let you run `docker compose` by hand on the server without it trying to build. Each deploy pins the exact commit's images on top.

`chmod 600 .env`. It holds every secret of the outlet.

## 3. GitHub (once)

Repository → Settings → Secrets and variables → Actions.

**Secrets**

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | the server's IP |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PATH` | `/srv/pos-system` |
| `DEPLOY_SSH_PORT` | only if SSH isn't on 22 |
| `DEPLOY_SSH_KEY_B64` | a key only CI uses: `ssh-keygen -t ed25519 -f ~/.ssh/pos_deploy -N ""`, add `pos_deploy.pub` to the server's `authorized_keys`, then `base64 < ~/.ssh/pos_deploy \| tr -d '\n' \| pbcopy` |
| `DEPLOY_KNOWN_HOSTS` | `ssh-keyscan -H <server ip>`, run once from your own machine |

**Variable:** `DEPLOY_ENABLED` = `true`.

Until `DEPLOY_ENABLED` is set, pushes to `main` still build and publish both images, but nothing is deployed.

## 4. First start

Run the **CI** workflow on `main` (Actions → CI → Run workflow), or push to `main`. The deploy job pulls both images, starts the stack, applies migrations, creates the built-in roles and waits for the API to be healthy. Caddy gets the certificate on the first request, within a minute.

Then create the owner account and fill in the outlet:

```bash
cd /srv/pos-system/backend
docker compose --env-file .env -f docker-compose.prod.yml exec api python manage.py createsuperuser
```

Sign in at `https://<hostname>` with that account, then:

1. **Pengaturan:** outlet name, address, NPWPD, PBJT and service charge, rounding, receipt header and footer.
2. **Staf:** an account for each cashier and waiter, with their role.
3. **Menu, Meja, Stok:** the real menu with photos, the floor plan, snack barcodes and opening stock.

Never run `seed_demo` on the production database: it creates demo staff and fake sales.

## 5. Backups

`backend/scripts/backup-postgres.sh` dumps the database and the uploaded photos into `backend/backups/`, keeps 30 days, and copies each file to an off-site bucket.

1. **Bucket.** Cloudflare R2 is the simplest: 10 GB free and no download fees. Create a bucket (e.g. `yicipang-pos-backups`) and an API token with **Object Read & Write** on that bucket only. Put the endpoint (`https://<account id>.r2.cloudflarestorage.com`), bucket name, access key and secret into the `BACKUP_S3_*` settings. Backblaze B2 or DigitalOcean Spaces work the same way.
2. **Schedule**, as `deploy` (`crontab -e`). The server clock is UTC; 17:00 UTC is 01:00 WITA, when the shop is closed:

   ```
   0 17 * * * /srv/pos-system/backend/scripts/backup-postgres.sh >> /srv/pos-system/backend/logs/backup.log 2>&1
   ```

3. **Check it now:** run the script once by hand, then confirm the two files in `backups/` and in the bucket.
4. **Practise a restore** before opening day, and every few months.

### Restoring

```bash
cd /srv/pos-system/backend
compose() { docker compose --env-file .env -f docker-compose.prod.yml "$@"; }
# Database (from backups/, or downloaded from the bucket):
compose exec -T db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/pos-<stamp>.dump
# Photos:
compose exec -T api tar -C /app -xzf - < backups/media-<stamp>.tar.gz
compose restart api
```

On a new server: do sections 1–2, start the stack (section 4) without creating the owner, then restore.

## 6. Cashier PC

Run the setup script with the production address (see [cashier-pc-setup.md](cashier-pc-setup.md)):

```powershell
powershell -ExecutionPolicy Bypass -File setup-cashier-pc.ps1 -Url https://pos.yicipang.id -Agent
```

The print agent only accepts that address.

## Day to day

- **Updates:** merge to `main`. CI tests, builds and deploys; the POS reloads the new version on its next page load. Migrations run on start.
- **Logs:** `docker compose --env-file .env -f docker-compose.prod.yml logs -f api` (or `caddy`).
- **Health:** `https://<hostname>/health/`. A free uptime monitor (UptimeRobot, Better Stack) on that URL emails you when the POS is down.
- **Rolling back** to an earlier commit's images:

  ```bash
  APP_IMAGE=ghcr.io/trixyncid/pos-api:<sha> WEB_IMAGE=ghcr.io/trixyncid/pos-web:<sha> \
    docker compose --env-file .env -f docker-compose.prod.yml up -d --no-build
  ```

  Migrations only go forward. If the bad release changed the database, restore the backup taken before it as well.
- **Disk:** each deploy prunes unused images. Check `df -h` now and then.
