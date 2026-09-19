'use client';

import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { CameraMapProps } from '@/components/map/CameraMap';
import type { TrafficCamera } from '@/features/cameras/types';
import { DEFAULT_MAP_ATTRIBUTION, DEFAULT_MAP_TILE_URL } from '@/lib/env';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const HCMC_CENTER: [number, number] = [10.7769, 106.7009];

export default function CameraMapInner({
  cameras,
  selectedId,
  userLocation,
  onSelect,
  onOpen,
  onBoundsChange,
  onRequestLocation,
  locationLoading,
}: CameraMapProps) {
  const tileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || DEFAULT_MAP_TILE_URL;
  const attribution = process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || DEFAULT_MAP_ATTRIBUTION;

  return (
    <div className="relative h-full min-h-0 w-full md:min-h-[420px]">
      <MapContainer
        center={HCMC_CENTER}
        zoom={12}
        className="h-full w-full"
        scrollWheelZoom
        dragging
        touchZoom
        doubleClickZoom
        boxZoom
        keyboard
        aria-label="HCM City traffic camera map"
      >
        <TileLayer attribution={attribution} url={tileUrl} />
        <BoundsWatcher onBoundsChange={onBoundsChange} />
        <ClusterLayer
          cameras={cameras}
          selectedId={selectedId}
          onSelect={onSelect}
          onOpen={onOpen}
        />
        {userLocation ? <UserMarker location={userLocation} /> : null}
        <MapChrome onRequestLocation={onRequestLocation} locationLoading={locationLoading} />
      </MapContainer>
    </div>
  );
}

function BoundsWatcher({
  onBoundsChange,
}: {
  onBoundsChange: CameraMapProps['onBoundsChange'];
}) {
  const onBoundsChangeRef = useRef(onBoundsChange);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  const map = useMapEvents({
    moveend() {
      const bounds = map.getBounds();
      onBoundsChangeRef.current({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      });
    },
  });

  useEffect(() => {
    const bounds = map.getBounds();
    onBoundsChangeRef.current({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [map]);

  return null;
}

function ClusterLayer({
  cameras,
  selectedId,
  onSelect,
  onOpen,
}: {
  cameras: TrafficCamera[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const map = useMap();
  const onSelectRef = useRef(onSelect);
  const onOpenRef = useRef(onOpen);
  const markersRef = useRef(new Map<string, L.Marker>());
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const camerasRef = useRef(cameras);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onOpenRef.current = onOpen;
    camerasRef.current = cameras;
  }, [cameras, onOpen, onSelect]);

  // Build markers only when the camera set changes — never on selection alone.
  useEffect(() => {
    let lastOpenAt = 0;
    const onPopupActivate = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLElement>('[data-open-camera]');
      if (!button) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const id = button.getAttribute('data-open-camera');
      if (!id) {
        return;
      }
      const now = Date.now();
      if (now - lastOpenAt < 400) {
        return;
      }
      lastOpenAt = now;
      onOpenRef.current(id);
    };

    const container = map.getContainer();
    container.addEventListener('click', onPopupActivate);
    container.addEventListener('pointerup', onPopupActivate);

    const cluster = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 48,
      // Avoid sticky cluster spiderfy / zoom quirks that can feel like a locked map.
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
    });
    const markersById = new Map<string, L.Marker>();

    cameras.forEach((camera) => {
      const marker = L.marker([camera.latitude, camera.longitude], {
        icon: cameraIcon(camera, false),
        title: camera.name,
        keyboard: true,
        riseOnHover: true,
      });
      marker.bindPopup(previewHtml(camera), {
        closeButton: true,
        className: 'camera-preview-popup',
        maxWidth: 260,
        offset: L.point(0, -8),
        autoPan: false,
      });
      marker.on('click', () => {
        onSelectRef.current(camera.id);
      });
      markersById.set(camera.id, marker);
      cluster.addLayer(marker);
    });

    markersRef.current = markersById;
    clusterRef.current = cluster;
    map.addLayer(cluster);

    map.dragging.enable();
    map.touchZoom.enable();

    return () => {
      container.removeEventListener('click', onPopupActivate);
      container.removeEventListener('pointerup', onPopupActivate);
      map.removeLayer(cluster);
      cluster.clearLayers();
      markersRef.current = new Map();
      clusterRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, cameraSignature(cameras)]);

  // Highlight selected marker and always reopen its floating thumbnail.
  // setIcon closes Leaflet popups, so we must openPopup again after every selection.
  useEffect(() => {
    const cluster = clusterRef.current;
    const markersById = markersRef.current;

    markersById.forEach((marker, id) => {
      const camera = camerasRef.current.find((item) => item.id === id);
      if (!camera) {
        return;
      }
      marker.setIcon(cameraIcon(camera, id === selectedId));
    });

    if (!selectedId || !cluster) {
      return;
    }

    const selectedMarker = markersById.get(selectedId);
    if (!selectedMarker) {
      return;
    }

    let cancelled = false;
    let moveHandler: (() => void) | null = null;

    const showPopup = () => {
      if (cancelled || !clusterRef.current) {
        return;
      }
      const open = () => {
        if (cancelled) {
          return;
        }
        selectedMarker.openPopup();
        map.dragging.enable();
      };
      try {
        cluster.zoomToShowLayer(selectedMarker, open);
      } catch {
        open();
      }
    };

    const latLng = selectedMarker.getLatLng();
    const visible = map.getBounds().pad(-0.1).contains(latLng);

    if (visible) {
      const timer = window.setTimeout(showPopup, 0);
      return () => {
        cancelled = true;
        window.clearTimeout(timer);
      };
    }

    moveHandler = () => {
      map.off('moveend', moveHandler!);
      showPopup();
    };
    map.on('moveend', moveHandler);
    map.panTo(latLng, { animate: true });

    return () => {
      cancelled = true;
      if (moveHandler) {
        map.off('moveend', moveHandler);
      }
    };
  }, [map, selectedId]);

  return null;
}

function cameraSignature(cameras: TrafficCamera[]): string {
  return cameras.map((camera) => camera.id).join(',');
}

function UserMarker({ location }: { location: { latitude: number; longitude: number } }) {
  const map = useMap();
  useEffect(() => {
    const marker = L.circleMarker([location.latitude, location.longitude], {
      radius: 8,
      color: '#0f766e',
      fillColor: '#14b8a6',
      fillOpacity: 0.9,
    }).bindPopup('Your location');
    marker.addTo(map);
    map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 14), {
      animate: true,
      duration: 0.8,
    });
    return () => {
      map.removeLayer(marker);
    };
  }, [location, map]);
  return null;
}

function MapChrome({
  onRequestLocation,
  locationLoading,
}: {
  onRequestLocation: () => void;
  locationLoading: boolean;
}) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-[1000] flex flex-col gap-2 max-md:bottom-[calc(5.5rem+env(safe-area-inset-bottom)+0.75rem)] max-md:top-auto">
      <button
        type="button"
        onClick={onRequestLocation}
        className="pointer-events-auto min-h-11 rounded-md bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        aria-label="Use my current location"
      >
        {locationLoading ? 'Locating…' : 'My location'}
      </button>
    </div>
  );
}

function cameraIcon(camera: TrafficCamera, selected: boolean): L.DivIcon {
  const color =
    camera.status === 'online' ? '#0f766e' : camera.status === 'offline' ? '#475569' : '#b45309';
  return L.divIcon({
    className: 'camera-marker',
    iconSize: selected ? [34, 34] : [26, 26],
    iconAnchor: selected ? [17, 17] : [13, 13],
    html: `<span class="camera-marker-dot ${selected ? 'is-selected' : ''}" style="background:${color}" title="${escapeHtml(camera.name)}"></span>`,
  });
}

function previewHtml(camera: TrafficCamera): string {
  const image = camera.thumbnailUrl
    ? `<img src="${escapeHtml(camera.thumbnailUrl)}" alt="" width="220" height="124" loading="lazy" draggable="false" />`
    : `<div class="camera-preview-empty">No preview</div>`;

  return `<button type="button" class="camera-preview" data-open-camera="${escapeHtml(camera.id)}" aria-label="Open viewer for ${escapeHtml(camera.name)}">
    ${image}
    <strong>${escapeHtml(camera.name)}</strong>
    <span>${escapeHtml(camera.district ?? 'District unknown')} · ${escapeHtml(camera.status)}</span>
    <span class="camera-preview-cta">Tap to open camera</span>
  </button>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
