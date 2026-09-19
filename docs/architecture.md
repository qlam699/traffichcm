# Architecture

## Overview

The UI talks only to this application's API and a normalized `TrafficCamera` model. Upstream details of the HCM City traffic portal stay behind a provider interface.

```
Browser
  → Next.js App Router pages
  → /api/cameras, /api/cameras/:id, /api/cameras/:id/snapshot
  → TrafficCameraProvider (hcmc | mock)
  → Official portal (optional) or labeled mock data
```

## Domain model

`src/features/cameras/types.ts` defines `TrafficCamera`, `CameraSource`, and `CameraStatus`. Zod schemas in `src/features/cameras/schemas/camera.ts` validate API input and output.

Providers:

- `TrafficCameraProvider` — `getCameras`, `getCameraById`, `getSnapshot`
- `HcmcTrafficCameraProvider` — public portal adapter
- `MockTrafficCameraProvider` — clearly labeled sample cameras

## Data flow

1. `GET /api/cameras` validates query parameters, rate-limits by client IP, and asks the configured provider for cameras.
2. The HCMC provider, if selected:
   - GETs `/Map.aspx` to obtain the same anonymous cookies a public browser receives
   - POSTs `FolderAjax.SearchQuery`
   - Parses AjaxPro DataTables without `eval`
   - Drops cameras without coordinates
   - Maps status, district, snapshot path, and optional HTTPS HLS
   - Caches the catalog in memory for `CAMERA_METADATA_CACHE_TTL_SECONDS`
3. Snapshots are never requested from an arbitrary URL. `GET /api/cameras/:id/snapshot` validates the camera id, then the HCMC provider fetches `ImageHandler.ashx?id={id}` on the allowlisted portal host. It retries transient failures, reuses in-flight requests, and keeps a 3-second cache so a flaky refresh does not blank the viewer. Catalog lookup is not required for snapshots.
4. The client uses TanStack Query. Search is debounced. The sidebar is virtualized. The map uses Leaflet marker clusters. Only the selected camera's full media is loaded.

## Security controls

- No `GET /api/proxy?url=`
- Camera ids must match `/^[a-f0-9]{24}$/i`
- Upstream hosts are allowlisted from `TRAFFIC_CAMERA_BASE_URL`
- Private/loopback hosts are rejected
- Response size and timeouts are capped
- Rate limits apply to list, detail, and snapshot routes
- Portal cookies stay server-side
- Demo Apple HLS URLs are discarded
- HTTP HLS and non-allowlisted hosts are not used as in-app streams

## Frontend layout

Default map tiles come from OpenStreetMap.de. OSM.org's own `tile.openstreetmap.org` servers often return empty images to non-browser clients, and CARTO's free raster tiles now watermark with "API KEY REQUIRED". Override with `NEXT_PUBLIC_MAP_TILE_URL` if needed.

- Desktop: map on the left, 400px sidebar on the right
- Mobile: map on top, collapsible bottom camera list
- Viewer: modal dialog with previous/next, copy link, original source, fullscreen, and auto-refresh for images
