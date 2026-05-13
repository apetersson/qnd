# Self-Hosted Docker Compose + Nginx + Certbot Deploy

Pattern for deploying web apps to self-managed VPS hosts running Docker Compose, Nginx reverse proxy, and Let's Encrypt certificates via Certbot.

Used across multiple projects on shared infrastructure.

## Host Layout

```
/data/
  docker-compose.yml          # Central compose file (single host)
  nginx/
    conf.d/                   # Per-domain vhost configs
    certs/                    # Let's Encrypt certs
    webroot/                  # ACME challenge directory
  <app>/
    dist/                     # Static files or app data
    <app>.env                 # Per-app env files
    postgres/                 # (optional) DB data volumes
  backups/
    <app>-deploy/             # Timestamped pre-deploy backups
```

## Nginx Vhost Pattern

```nginx
# HTTP-only (pre-certificate bootstrap)
server {
    listen 80;
    server_name app.example.com;
    root /srv/www;

    location /.well-known {
        alias /srv/www/.well-known;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS (post-certificate)
server {
    listen 443 ssl http2;
    server_name app.example.com;
    root /srv/www;

    # ACME still needed for renewals
    location /.well-known {
        alias /srv/www/.well-known;
    }

    # SPA fallback for static sites
    location / {
        try_files $uri $uri.html $uri/ /index.html;
    }

    # Reverse proxy to compose service (when applicable)
    location /api/ {
        resolver 127.0.0.11 ipv6=off valid=30s;
        set $upstream http://backend-service:3000;
        proxy_pass $upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    ssl_certificate      /etc/ssl/certs/app.example.com/fullchain.pem;
    ssl_certificate_key  /etc/ssl/certs/app.example.com/privkey.pem;

    add_header Strict-Transport-Security "max-age=63072000";
    add_header X-Content-Type-Options "nosniff";
    add_header X-Frame-Options "DENY";
}
```

## Certificate Bootstrapping

```bash
# 1. Deploy HTTP-only vhost first
# 2. Obtain certificate
certbot certonly \
  --non-interactive \
  --agree-tos \
  -m admin@example.com \
  --webroot \
  -w /data/nginx/webroot \
  -d app.example.com \
  --config-dir /data/nginx/certs \
  --work-dir /data/nginx/certs/.work \
  --logs-dir /data/nginx/certs/.logs

# 3. Copy certs to nginx-accessible location
cp -L /etc/letsencrypt/live/app.example.com/fullchain.pem /data/nginx/certs/app.example.com/fullchain.pem
cp -L /etc/letsencrypt/live/app.example.com/privkey.pem /data/nginx/certs/app.example.com/privkey.pem

# 4. Deploy HTTPS vhost and reload
docker exec nginx_container nginx -t
docker exec nginx_container nginx -s reload
```

## Static Site Deploy (rsync)

```bash
# Build locally
pnpm install && pnpm build

# Upload to server (dist only)
rsync -az --delete -e 'ssh -o ClearAllForwardings=yes' \
  dist/ server_host:/data/app.example.com/dist/

# Verify
curl -sI https://app.example.com/
```

## Docker Compose Service Deploy

For multi-service apps deployed as compose services:

```bash
# 1. Pull new images
docker-compose pull app-service

# 2. Recreate service (with workaround for docker-compose v1)
docker-compose up -d app-service

# 3. Verify
docker-compose logs --tail=50 app-service
curl -s https://app.example.com/health
```

## docker-compose v1 Compatibility

Hosts running `docker-compose` (v1, not `docker compose`) may hit `KeyError: 'ContainerConfig'` on `up -d --force-recreate`.

**Workaround:**
```bash
# Instead of --force-recreate, remove then recreate
docker-compose rm -sf service_name
docker-compose up -d service_name
```

## Pre-Deploy Backup Pattern

```bash
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
backup_dir="/data/backups/app-deploy/${timestamp}"
mkdir -p "${backup_dir}"

cp /data/docker-compose.yml "${backup_dir}/docker-compose.yml"
cp -a /data/nginx/conf.d "${backup_dir}/nginx-conf.d/"
```

## Verification Checklist

- `https://app.example.com` returns HTTP 200
- `https://app.example.com/health` returns expected version
- SSL certificate valid (not expired)
- HTTP → HTTPS redirect works
- Static assets load (CSS, JS, images)
- API endpoints respond
