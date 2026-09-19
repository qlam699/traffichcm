# Official portal research

Date inspected: 19 September 2026  
Official map: https://abc.com/Map.aspx  
Terms of use: https://abc.com/TermOfUse/

This report documents how the public Ho Chi Minh City traffic portal loads camera data. No authentication wall, CAPTCHA, or access-control bypass was used. Findings come from the public map page, its published JavaScript, and the same network requests the page makes for anonymous visitors.

## Summary

There is **no documented public JSON API**. Camera metadata is loaded through an undocumented AjaxPro endpoint that the official map already calls after a visitor opens `Map.aspx`. Most cameras are **periodically refreshed JPEG snapshots**, not live video. A minority advertise HLS playlists. The example `videoUrl` in the project brief is a **generic Apple/Bitmovin demo stream**, used by the official player as a fallback when a camera has no `VideoUrl`. It is not a Ho Chi Minh City traffic camera.

## How the Camera layer loads

1. The map is an ExtJS / Vietbando VDMS application.
2. Enabling the **Camera** checkbox runs `HTDP.Public.Global.getCamData()`.
3. That function POSTs to:

   `POST /ajaxpro/VDMS.Web.Library.AJAX.FolderAjax,VDMS.Web.Library.ashx`  
   Header: `X-AjaxPro-Method: SearchQuery`  
   Body (named JSON, not a positional array):

   ```json
   {
     "path": "/root/vdms/tangthu/data/layerdata/camera",
     "isInTree": false,
     "searchKey": "",
     "layer": ["CAMERA"],
     "detail": true,
     "page": 0,
     "limit": -1,
     "filterQuery": ["Publish:true"],
     "sortby": null,
     "returnFields": ["CamId", "Code", "Location", "SnapshotUrl", "CamType", "Disctrict", "Publish", "ManagementUnit", "CamStatus", "PTZ", "Angle"]
   }
   ```

4. A request **without** the anonymous cookies issued by `Map.aspx` returns `User is not authenticated`. Visiting `Map.aspx` sets `ASP.NET_SessionId` and `.VDMS` for every public visitor. That is an anonymous portal session, not a logged-in account.
5. The response is AjaxPro text, not strict JSON. It embeds `new Ajax.Web.DataTable(...)` constructors. The official page `eval`s this through AjaxPro's converter. This app parses that format with a dedicated recursive parser and does **not** evaluate upstream JavaScript.
6. Observed catalog size on 19 September 2026: **796 published cameras** after coordinate filtering in this app (earlier raw AjaxPro samples were around 694 rows). District (`Disctrict`) is missing on most cameras. A minority include `VideoStreaming` and a `VideoUrl`.

## Camera metadata fields

| Field | Meaning |
| --- | --- |
| `CamId` | 24-character hex id, used throughout the official player |
| `DisplayName` / `Title` | Intersection or camera name |
| `Code` | Internal code such as `TTH 406` |
| `Location` | Nested table whose `Shape` is WKT `POINT(longitude latitude)` |
| `Disctrict` | District name when present (official spelling) |
| `CamStatus` | `UP` when the official map treats the camera as live |
| `VideoUrl` | Optional HLS playlist |
| `VideoStreaming` | `1` when the official UI offers a video toggle |
| `SnapshotUrl` | Optional third-party snapshot, often `http://camera.thongtingiaothong.vn/api/snapshot/{id}` |
| `ModifiedDate` | Last update timestamp |

Cameras without coordinates are skipped. Non-`UP` cameras older than **5 minutes** are also skipped by the official script (`DisableCameraTime: 5`).

The official site does **not** page by map bounds. The catalog is loaded in one request (`limit: -1`). This app therefore caches the catalog server-side and can filter by bounds locally.

## Images and streams

### Snapshots (primary)

The official compact player builds:

`{origin}:8007/Render/CameraHandler.ashx?id={CamId}&bg=black&w=&h=`

Port **8007 returned HTTP 403** from this environment. The expanded player uses:

`https://abc.com/render/ImageHandler.ashx?id={CamId}`

That endpoint returned `Content-Type: image/jpeg` **without login** (about 55–57 KB). It does not send `Access-Control-Allow-Origin`, so the browser can display the image in an `<img>` tag but canvas/fetch from another origin is blocked. This app therefore proxies snapshots **by camera id** through `GET /api/cameras/:id/snapshot` and never accepts an arbitrary URL.

Default refresh interval in `buildCamInterval` is **5000 ms**. The interval combo offers 5–10 seconds. This app refreshes image cameras every 5 seconds, pauses when the document is hidden, and cache-busts only for refresh.

### HLS (minority)

When `VideoStreaming` is truthy and `VideoUrl` is set, the official player can switch to Video.js HLS. Observed hosts:

- `http://camera.thongtingiaothong.vn/s/{id}/index.m3u8`
- `http://125.234.114.126:11984/api/stream.m3u8?src=...`

Those playlists are **HTTP**. A HTTPS web app cannot play them directly because of mixed content. Requests to `camera.thongtingiaothong.vn` also timed out from this environment. The official expand URL still injects this demo fallback when `VideoUrl` is missing:

`https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8`

That URL is **not** a live HCMC camera. This app ignores it.

HTTPS playlists on `camera.thongtingiaothong.vn` are allowlisted if present. Other hosts, IP addresses, and HTTP playlists are not used as in-app streams. The viewer then uses the snapshot and an "Open original source" link to the official expand page.

### Embedded official player

Detail URLs follow:

`/expandcameraplayer/?camId={id}&camLocation={name}&camMode=camera|video&videoUrl={optional}`

`camMode=camera` is image mode. This app never copies the demo `videoUrl` into generated links.

## CORS, cookies, and headers

| Request | CORS | Auth |
| --- | --- | --- |
| FolderAjax SearchQuery | No `Access-Control-Allow-Origin` | Anonymous `Map.aspx` session cookies |
| ImageHandler.ashx | No ACAO; JPEG still loads in `<img>` | None observed |
| CameraHandler :8007 | ACAO `*` but HTTP 403 | Blocked from this environment |

Required SearchQuery header: `X-AjaxPro-Method: SearchQuery`.  
Content type: `text/plain; charset=utf-8`.

This app keeps portal cookies on the server only. They are not logged and not forwarded to the client.

## Terms and permission

The portal terms allow viewing, downloading, and printing content for **personal, non-commercial** use, and they prohibit copying, publishing, modifying, or removing notices without written permission. There is no published license for a third-party redistribution API.

Assumptions made for this project:

- Calling the same public endpoints the official map uses, without storing images, with attribution and an "open original source" link, is a convenience viewer rather than a scrape-and-republish archive.
- If that reading is too aggressive for a given deployment, set `TRAFFIC_CAMERA_PROVIDER=mock` and connect an approved source later through `TrafficCameraProvider`.

No CAPTCHA, password area, or rate-limit bypass was implemented.

## Limitations

- AjaxPro is undocumented and can change without notice.
- District is missing on most cameras.
- Live HLS is uncommon and usually HTTP-only.
- Port 8007 camera handler is not usable here.
- Third-party snapshot/HLS hosts were unreliable from this network.
- The official catalog is not a stable public API. The adapter isolates that instability from the UI.
