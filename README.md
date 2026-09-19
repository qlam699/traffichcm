# HCM City Traffic Camera Viewer

A desktop-first Next.js app for browsing public traffic cameras in HCM City. It shows cameras on an interactive map, a searchable sidebar, and a viewer for snapshots or HLS streams when those public sources exist.

## Features

- Interactive Leaflet map of HCM City with marker clustering
- Searchable, filterable, virtualized camera sidebar
- Selection synced between map and list
- Snapshot viewer with 5-second auto-refresh, matching the official player default
- HLS playback through native video or `hls.js` when a public HTTPS playlist is available
- Deep links at `/camera/[id]`
- Mock provider for local development

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `TRAFFIC_CAMERA_PROVIDER` | `hcmc` for live public portal data, `mock` for labeled sample cameras |
| `TRAFFIC_CAMERA_BASE_URL` | Official portal origin. Only this host is contacted. |
| `NEXT_PUBLIC_MAP_TILE_URL` | Optional OSM-compatible tile URL |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Optional tile attribution |
| `UPSTREAM_REQUEST_TIMEOUT_MS` | Timeout for metadata and snapshot requests |
| `CAMERA_METADATA_CACHE_TTL_SECONDS` | In-memory metadata cache TTL |

No API keys are required for the default OpenStreetMap.de raster tiles. Override `NEXT_PUBLIC_MAP_TILE_URL` if a host blocks those tiles.

## Production build

```bash
npm run typecheck
npm run lint
npm run build
npm start
```

## Deployment notes

- Deploy as a Node.js Next.js app. Server routes must be able to reach `giaothong` if `TRAFFIC_CAMERA_PROVIDER=hcmc`.
- Do not expose a generic URL proxy. Snapshots are fetched by camera id only.
- Anonymous portal session cookies stay on the server and are never sent to the browser.
- Do not persist camera images or streams.
- Keep `TRAFFIC_CAMERA_BASE_URL` on the official hostname.

## Production / VPS + Webinoly (`traffic.codayroi.com`)

Same pattern as your bacpq VPS deploy: GitHub Actions **builds on CI**, packs a release tarball (`.next`, `public`, production `node_modules`, …), SCPs it to the VPS, then wipes `/var/www/traffichcm` and extracts — **no `git clone` / `npm run build` on the VPS**.

DNS: **A** record `traffic.codayroi.com` → VPS IP. Webinoly must already be installed. App listens on `127.0.0.1:8790`; Nginx reverse-proxies via Webinoly.

### GitHub Actions (push `main` → build + deploy)

Workflow: `.github/workflows/deploy-vps.yml`

**1. SSH key**

```bash
ssh-keygen -t ed25519 -C "github-actions-traffichcm" -f ./traffichcm-deploy -N ""
ssh-copy-id -i ./traffichcm-deploy.pub USER@VPS_IP
```

SSH user needs passwordless `sudo` for `deploy.sh` / `systemctl` (or use `root`).

**2. GitHub repo → Settings → Secrets and variables → Actions**

| Secret         | Example                                    |
| -------------- | ------------------------------------------ |
| `VPS_HOST`     | VPS IP                                     |
| `VPS_USER`     | `root` or sudo user                        |
| `VPS_SSH_KEY`  | private key `traffichcm-deploy` (no passphrase) |

Optional **Variables**: `PORT` (`8790`), `TRAFFIC_CAMERA_PROVIDER`, `TRAFFIC_CAMERA_BASE_URL`, map tile overrides, timeouts (see `deploy/env.example`).

Push to `main` (or **Actions → Deploy VPS Webinoly → Run workflow**). First deploy runs `scripts/setup-vps-webinoly.sh` (systemd user + Webinoly site + SSL). Later deploys only extract the artifact and restart.

```bash
# Manual one-liners on VPS if needed
sudo site traffic.codayroi.com -proxy=[127.0.0.1:8790]
sudo site traffic.codayroi.com -ssl=on
journalctl -u traffichcm -f
```

## Documentation

- [Research](docs/research.md)
- [Architecture](docs/architecture.md)
- [UI walkthrough](docs/ui-walkthrough.md)

## License and use

Review the official portal terms before any use beyond personal viewing. The portal states that content is for personal, non-commercial viewing and may not be copied or republished without permission.
