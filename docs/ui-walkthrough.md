# UI walkthrough

1. Open the app. The map centers on Ho Chi Minh City. The sidebar lists cameras.
2. If `TRAFFIC_CAMERA_PROVIDER=mock`, a warning banner states that labeled mock cameras are shown.
3. Type in **Search cameras** to filter by name, road, intersection, or district.
4. Use the district, status, and sort controls. Distance sort needs **My location**.
5. Click a sidebar row. The matching marker is highlighted and the map pans to it.
6. Click a map marker to open a floating thumbnail near the point. Tap that thumbnail to open the camera viewer (fullscreen on mobile, larger dialog on desktop). Sidebar thumbnail clicks also open the viewer; the name selects/pans without opening.
7. In the viewer, image cameras refresh every 5 seconds unless paused. HLS cameras use a muted player. Offline cameras without media show an error and keep **Open original source** when a portal URL exists.
8. **Copy camera link** copies `/camera/{id}`. Opening that path selects the same camera.
9. On a narrow viewport, the map is full-screen and cameras live in a bottom sheet (peek / half / full). Tap the sheet handle to resize. Use **Filters** for district, status, sort, and map-view-only.

Screenshots can be captured from `npm run dev` or a production `npm start` after the build is verified. Live verification on 19 September 2026 showed 796 cameras, OpenStreetMap.de tiles, clustered markers, search for "Nguyen Oanh", and a working JPEG viewer for `Nguyễn Oanh - Nguyễn Văn Lượng` (`6623ecc16f998a001b25269e`) with the official expand-player link. See `docs/screenshots/map-sidebar.png`. The live official map uses green camera markers and a snapshot popup; this app keeps that information architecture but uses a two-pane layout instead of ExtJS.
