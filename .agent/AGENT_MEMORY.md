# AGENT MEMORY — traffichcm

Bộ nhớ dự án cho AI agent. Đọc file này TRƯỚC khi dò code. Cập nhật khi có thay đổi kiến trúc / quy ước / bài học mới.

## 1. Tổng quan

- App Next.js xem camera giao thông công khai TP.HCM: bản đồ Leaflet + sidebar tìm kiếm + viewer (snapshot JPEG tự refresh 5s, hoặc HLS nếu có).
- Stack: **Next.js 16.3.5 (App Router, có breaking changes — đọc `node_modules/next/dist/docs/` trước khi dùng API Next)**, React 19.2, TypeScript, Tailwind v4, TanStack Query v5, TanStack Virtual, react-leaflet 5 + leaflet.markercluster, hls.js, zod v4.
- Path alias: `@/*` → `src/*`.
- Scripts: `npm run dev | build | start | lint | typecheck | format`. Không có test framework.
- Lockfile: có cả `package-lock.json` và `pnpm-lock.yaml`; CI dùng **npm** (`npm ci`) → khi thêm dependency phải cập nhật `package-lock.json`.
- Docs khác: [architecture.md](../docs/architecture.md), [research.md](../docs/research.md), [ui-walkthrough.md](../docs/ui-walkthrough.md).

## 2. Luồng dữ liệu

```
Browser (TrafficExplorer)
  → useCameras() → GET /api/cameras            (list, rate limit 30/phút/IP)
  → <img src="/api/cameras/:id/snapshot?t=..."> (snapshot, rate limit 240/phút/IP)
  → GET /api/cameras/:id                        (detail, dùng bởi useCamera)
      → getTrafficCameraProvider()  (singleton, src/providers/index.ts)
          → HcmcTrafficCameraProvider | MockTrafficCameraProvider
              → portal chính thức (TRAFFIC_CAMERA_BASE_URL)
```

- Client tải **toàn bộ** danh sách camera 1 lần; filter/sort/bounds làm **phía client** (`filterCameras`, `sortCameras` trong TrafficExplorer). API vẫn hỗ trợ query params nhưng UI hiện không dùng.
- Provider `hcmc`:
  1. GET `/Map.aspx` lấy cookie phiên ẩn danh (cache `sessionCache`, TTL ≥120s).
  2. POST AjaxPro `FolderAjax.SearchQuery` (header `X-AjaxPro-Method: SearchQuery`, body cố định `SEARCH_BODY`) → parse bằng `parseAjaxPro` (parser tự viết, KHÔNG eval, hỗ trợ `new Ajax.Web.DataTable(...)`) → `extractSearchQueryRows` → `normalizeCameraRow`.
  3. Cache danh sách in-memory theo `CAMERA_METADATA_CACHE_TTL_SECONDS`.
  4. Snapshot: GET `/render/ImageHandler.ashx?id=` kèm cookie + Referer; retry 3 lần (`fetchUpstreamWithRetry`), dedupe in-flight, cache 3s; lỗi → clear session rồi thử lại 1 lần.
  5. Nếu response chứa `"User is not authenticated"` → clear session, ném 502.
- Provider `mock`: dữ liệu mẫu `MOCK_CAMERAS`, snapshot là SVG (`createMockSnapshotSvg`); API trả `warning`.

## 3. Bản đồ file quan trọng

| File | Vai trò |
| --- | --- |
| `src/app/page.tsx`, `src/app/camera/[id]/page.tsx` | Trang chủ & deep link (validate id rồi render `TrafficExplorer initialCameraId`) |
| `src/app/providers.tsx` | QueryClientProvider |
| `src/app/api/cameras/route.ts` | List; validate bằng `cameraQuerySchema`, output qua `cameraListResultSchema` |
| `src/app/api/cameras/[id]/route.ts` | Detail |
| `src/app/api/cameras/[id]/snapshot/route.ts` | Trả bytes ảnh, `Cache-Control: no-store` |
| `src/providers/traffic-camera-provider.ts` | Interface `TrafficCameraProvider` (`getCameras`, `getCameraById`, `getSnapshot`) + `CameraSnapshot` |
| `src/providers/hcmc-traffic-provider.ts` | Adapter portal thật |
| `src/providers/mock-traffic-provider.ts` | Mock |
| `src/features/cameras/types.ts` | `TrafficCamera`, `CameraSource` (`image`/`hls`/`embed`), `CameraStatus`, `CameraQuery`, `CameraSort` (`name`/`distance`/`recent`) |
| `src/features/cameras/schemas/camera.ts` | Zod schemas, `CAMERA_ID_PATTERN = /^[a-f0-9]{24}$/i`, `isCameraId` |
| `src/features/cameras/utils/normalize.ts` | Row upstream → `TrafficCamera` (bỏ row không có id/toạ độ) |
| `src/features/cameras/utils/source.ts` | `parseWktPoint` (WKT `POINT(lng lat)`), `detectCameraSource`, `sanitizeHlsUrl` (chỉ https, host allowlist `camera.thongtingiaothong.vn`, chặn demo cloudfront), `mapCameraStatus`, `buildOriginalPageUrl` |
| `src/features/cameras/utils/{filter,sort,distance,url}.ts` | Lọc (query bỏ dấu, district, status, bounds), sắp xếp, haversine |
| `src/features/cameras/hooks/*` | `useCameras`, `useCamera`, `useDebouncedValue`, `useMediaQuery`, `useRecentCameras` (localStorage `traffichcm.recentCameraIds`, max 30), `useUserLocation` |
| `src/lib/http-client.ts` | `fetchUpstream` (host allowlist, chặn IP private, timeout, maxBytes), `fetchUpstreamWithRetry`, `readLimitedText/Buffer`, `HttpError` |
| `src/lib/ajaxpro.ts` | Parser AjaxPro an toàn |
| `src/lib/cache.ts` | `TtlCache<T>` in-memory |
| `src/lib/rate-limit.ts` | Sliding window in-memory theo `x-forwarded-for`/`x-real-ip` |
| `src/lib/env.ts` | Zod env + `DEFAULT_MAP_TILE_URL` (tile.openstreetmap.de) |
| `src/components/TrafficExplorer.tsx` | Component gốc client: state search/district/status/sort/selectedId/viewerOpen/bounds/mapOnly; desktop = map + sidebar 400px, mobile (`max-width: 767px`) = map + `BottomSheet` |
| `src/components/map/CameraMap.tsx` | `next/dynamic` ssr:false → `CameraMapInner.tsx` |
| `src/components/map/CameraMapInner.tsx` | Leaflet, marker cluster, popup preview (nút `data-open-camera`), highlight marker chọn |
| `src/components/sidebar/CameraSidebar.tsx` | List ảo hoá, variant `desktop`/`sheet` |
| `src/components/camera-viewer/*` | `CameraViewer` (`<dialog>` modal, prev/next phím ←/→ & swipe, copy link, fullscreen; mobile = layout riêng nền đen full màn hình, header 1 dòng, toolbar icon `ToolButton`/`ICONS` ở đáy; desktop = modal trắng có nút chữ), `ImagePlayer` (double-buffer img, refresh ≥5s, bỏ qua khi tab ẩn, retry 1.5s), `HlsPlayer`, `EmbedPlayer` |
| `src/components/common/*` | `BottomSheet` (`peek`/`half`/`expanded`), `Feedback` (Loading/Empty/Error), `StatusBadge` |

## 4. Env

`TRAFFIC_CAMERA_PROVIDER` (`hcmc`|`mock`, mặc định `hcmc`), `TRAFFIC_CAMERA_BASE_URL`, `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`, `UPSTREAM_REQUEST_TIMEOUT_MS` (1000–30000, mặc định 10000), `CAMERA_METADATA_CACHE_TTL_SECONDS` (10–600, mặc định 60). Mẫu: `.env.example`, `deploy/env.example`.

## 5. Quy tắc bảo mật (không được phá)

- KHÔNG tạo proxy kiểu `/api/proxy?url=`. Snapshot chỉ lấy theo camera id đã validate.
- Mọi request upstream đi qua `fetchUpstream` với `allowedHosts` (host của `TRAFFIC_CAMERA_BASE_URL`).
- Cookie portal chỉ ở server. Không lưu ảnh/stream.
- HLS chỉ dùng nếu https + host trong allowlist.

## 6. Gotchas / quy ước

- Upstream field bị viết sai chính tả: `Disctrict` (normalize đọc cả `Disctrict` và `District`).
- Status: `CamStatus === 'UP'` → online; cập nhật trong 5 phút → unknown; có status khác → offline.
- `ClusterLayer` chỉ rebuild marker khi `cameraSignature(cameras)` đổi; `setIcon` đóng popup nên phải `openPopup` lại sau khi chọn.
- `useMediaQuery` trả `false` ở lần render đầu rồi mới đổi → component rẽ nhánh mobile/desktop sẽ remount element. `CameraViewer` render 2 `<dialog>` khác nhau nên effect `showModal()` phải có `isMobile` trong deps.
- Players (`ImagePlayer`/`HlsPlayer`/`EmbedPlayer`) chỉ bo góc từ `md:` để mobile tràn viền.
- Route handlers dùng `export const dynamic = 'force-dynamic'`; `params` là `Promise` (phải `await`).
- Cache/rate-limit/provider đều in-memory, singleton theo process (chạy 1 instance).

## 7. Deploy

- GitHub Actions `.github/workflows/deploy-vps.yml`: push `main` → build trên CI (Node 22, `npm ci`) → tar (`.next`, `public`, `node_modules` prod, …) → scp lên VPS → giải nén vào `/var/www/traffichcm` → restart systemd `traffichcm`.
- App chạy `127.0.0.1:8790`, Nginx (Webinoly) reverse proxy cho `traffic.codayroi.com`. Lần đầu chạy `scripts/setup-vps-webinoly.sh`. Log: `journalctl -u traffichcm -f`.

## 8. Nhật ký thay đổi / bài học

<!-- Thêm mục mới ở đầu: YYYY-MM-DD — nội dung ngắn -->
- 2026-10-28 — Làm lại UI viewer mobile compact (nền đen, media tràn viền, toolbar icon 1 hàng, bỏ menu More); fix dialog không mở lại khi đổi mobile/desktop.
- 2026-10-28 — Chuyển file bộ nhớ từ `docs/` sang `.agent/`.
- 2026-10-28 — Tạo file bộ nhớ này.
