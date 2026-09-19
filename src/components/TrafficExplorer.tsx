'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CameraViewer } from '@/components/camera-viewer/CameraViewer';
import { BottomSheet, type SheetSnap } from '@/components/common/BottomSheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/Feedback';
import { CameraMap } from '@/components/map/CameraMap';
import { CameraSidebar } from '@/components/sidebar/CameraSidebar';
import { useCameras } from '@/features/cameras/hooks/useCameras';
import { useDebouncedValue } from '@/features/cameras/hooks/useDebouncedValue';
import { useMediaQuery } from '@/features/cameras/hooks/useMediaQuery';
import { useRecentCameras } from '@/features/cameras/hooks/useRecentCameras';
import { useUserLocation } from '@/features/cameras/hooks/useUserLocation';
import type { CameraSort, CameraStatus, GeoBounds } from '@/features/cameras/types';
import { filterCameras } from '@/features/cameras/utils/filter';
import { sortCameras } from '@/features/cameras/utils/sort';

export function TrafficExplorer({ initialCameraId }: { initialCameraId?: string }) {
  const camerasQuery = useCameras();
  const allCameras = useMemo(
    () => camerasQuery.data?.cameras ?? [],
    [camerasQuery.data?.cameras],
  );
  const { location, loading: locating, error: locationError, requestLocation } = useUserLocation();
  const { recentIds, remember } = useRecentCameras();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const [search, setSearch] = useState('');
  const [district, setDistrict] = useState('');
  const [status, setStatus] = useState<CameraStatus | 'all'>('all');
  const [sort, setSort] = useState<CameraSort>('name');
  const [selectedId, setSelectedId] = useState<string | null>(initialCameraId ?? null);
  const [viewerOpen, setViewerOpen] = useState(Boolean(initialCameraId));
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>('peek');
  const [bounds, setBounds] = useState<GeoBounds | undefined>(undefined);
  const [mapOnly, setMapOnly] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const filtered = useMemo(
    () =>
      filterCameras(allCameras, {
        query: debouncedSearch,
        district: district || undefined,
        status,
        bounds: mapOnly ? bounds : undefined,
      }),
    [allCameras, bounds, debouncedSearch, district, mapOnly, status],
  );
  const cameras = useMemo(
    () => sortCameras(filtered, sort, { userLocation: location, recentIds }),
    [filtered, location, recentIds, sort],
  );

  const selected =
    cameras.find((camera) => camera.id === selectedId) ??
    allCameras.find((camera) => camera.id === selectedId) ??
    null;

  const select = useCallback(
    (id: string, open = false) => {
      setSelectedId(id);
      remember(id);
      if (open) {
        setViewerOpen(true);
      }
    },
    [remember],
  );

  const handleMapSelect = useCallback((id: string) => select(id), [select]);
  const handleMapOpen = useCallback((id: string) => select(id, true), [select]);
  const handleSidebarSelect = useCallback(
    (id: string) => {
      select(id);
      if (isMobile) {
        setSheetSnap('peek');
      }
    },
    [isMobile, select],
  );
  const handleSidebarOpen = useCallback((id: string) => select(id, true), [select]);

  const selectedIndex = cameras.findIndex((camera) => camera.id === selectedId);
  const missingDeepLink =
    Boolean(initialCameraId) &&
    camerasQuery.isSuccess &&
    !allCameras.some((camera) => camera.id === initialCameraId);

  useEffect(() => {
    if (
      initialCameraId &&
      camerasQuery.isSuccess &&
      allCameras.some((camera) => camera.id === initialCameraId)
    ) {
      setViewerOpen(true);
    }
  }, [allCameras, camerasQuery.isSuccess, initialCameraId]);

  const sidebarProps = {
    cameras,
    selectedId,
    search,
    district,
    status,
    sort,
    mapOnly,
    userLocation: location,
    onSearchChange: setSearch,
    onDistrictChange: setDistrict,
    onStatusChange: setStatus,
    onSortChange: setSort,
    onMapOnlyChange: setMapOnly,
    onSelect: handleSidebarSelect,
    onOpen: handleSidebarOpen,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-900">HCMC Traffic Cameras</h1>
          <p className="hidden text-sm text-slate-600 md:block">
            Public cameras from the Ho Chi Minh City traffic portal, shown on a simpler map.
          </p>
          <p className="text-xs text-slate-600 md:hidden">{cameras.length} cameras</p>
        </div>
        <label className="hidden items-center gap-2 text-sm text-slate-700 md:flex">
          <input
            type="checkbox"
            checked={mapOnly}
            onChange={(event) => setMapOnly(event.target.checked)}
          />
          Only cameras in map view
        </label>
      </header>

      {camerasQuery.data?.warning ? (
        <p className="bg-amber-100 px-4 py-2 text-sm text-amber-950" role="status">
          {camerasQuery.data.warning}
        </p>
      ) : null}
      {locationError ? (
        <p className="bg-slate-100 px-4 py-2 text-sm text-slate-700" role="status">
          {locationError}
        </p>
      ) : null}

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          className="relative min-h-0 min-w-0 flex-1 md:min-h-0"
          aria-label="Map"
        >
          {camerasQuery.isLoading ? <LoadingState label="Loading cameras" /> : null}
          {camerasQuery.isError ? (
            <ErrorState
              title="Camera list unavailable"
              detail={camerasQuery.error.message}
              onRetry={() => void camerasQuery.refetch()}
            />
          ) : null}
          {missingDeepLink ? (
            <div className="absolute inset-x-0 top-3 z-[1100] px-3">
              <div className="rounded-md bg-white/95 p-3 text-sm text-slate-800 shadow">
                This camera id does not exist in the current public catalog.
              </div>
            </div>
          ) : null}
          {camerasQuery.isSuccess && allCameras.length === 0 ? (
            <EmptyState
              title="No cameras found"
              detail="The provider did not return any cameras with coordinates."
            />
          ) : null}
          {camerasQuery.isSuccess && allCameras.length > 0 ? (
            <CameraMap
              cameras={cameras}
              selectedId={selectedId}
              userLocation={location}
              onSelect={handleMapSelect}
              onOpen={handleMapOpen}
              onBoundsChange={setBounds}
              onRequestLocation={requestLocation}
              locationLoading={locating}
            />
          ) : null}
        </section>

        {!isMobile ? <CameraSidebar {...sidebarProps} variant="desktop" /> : null}

        {isMobile ? (
          <BottomSheet
            snap={sheetSnap}
            onSnapChange={setSheetSnap}
            title="Cameras"
            subtitle={`${cameras.length} available`}
          >
            <CameraSidebar {...sidebarProps} variant="sheet" />
          </BottomSheet>
        ) : null}
      </div>

      {viewerOpen && selected ? (
        <CameraViewer
          camera={selected}
          onClose={() => setViewerOpen(false)}
          onPrevious={
            selectedIndex > 0
              ? () => select(cameras[selectedIndex - 1]?.id ?? selected.id, true)
              : undefined
          }
          onNext={
            selectedIndex >= 0 && selectedIndex < cameras.length - 1
              ? () => select(cameras[selectedIndex + 1]?.id ?? selected.id, true)
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
