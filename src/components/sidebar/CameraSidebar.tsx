'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StatusBadge } from '@/components/common/StatusBadge';
import { EmptyState } from '@/components/common/Feedback';
import type { CameraSort, CameraStatus, TrafficCamera, UserLocation } from '@/features/cameras/types';
import { formatDistance, haversineKm } from '@/features/cameras/utils/distance';
import { uniqueDistricts } from '@/features/cameras/utils/filter';

export function CameraSidebar({
  cameras,
  selectedId,
  search,
  district,
  status,
  sort,
  mapOnly,
  userLocation,
  variant = 'desktop',
  onSearchChange,
  onDistrictChange,
  onStatusChange,
  onSortChange,
  onMapOnlyChange,
  onSelect,
  onOpen,
}: {
  cameras: TrafficCamera[];
  selectedId: string | null;
  search: string;
  district: string;
  status: CameraStatus | 'all';
  sort: CameraSort;
  mapOnly: boolean;
  userLocation: UserLocation | null;
  variant?: 'desktop' | 'sheet';
  onSearchChange: (value: string) => void;
  onDistrictChange: (value: string) => void;
  onStatusChange: (value: CameraStatus | 'all') => void;
  onSortChange: (value: CameraSort) => void;
  onMapOnlyChange: (value: boolean) => void;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const districts = useMemo(() => uniqueDistricts(cameras), [cameras]);
  const useVirtual = cameras.length > 40;
  const isSheet = variant === 'sheet';
  const activeFilterCount =
    (district ? 1 : 0) + (status !== 'all' ? 1 : 0) + (sort !== 'name' ? 1 : 0) + (mapOnly ? 1 : 0);

  const virtualizer = useVirtualizer({
    count: useVirtual ? cameras.length : 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (isSheet ? 88 : 96),
    overscan: 8,
    initialRect: { width: 400, height: 800 },
  });

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const index = cameras.findIndex((camera) => camera.id === selectedId);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'auto' });
    }
  }, [cameras, selectedId, virtualizer]);

  const filters = (
    <div className={`grid gap-2 ${isSheet ? 'grid-cols-1' : 'grid-cols-3'}`}>
      <select
        aria-label="Filter by district"
        value={district}
        onChange={(event) => onDistrictChange(event.target.value)}
        className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">All districts</option>
        {districts.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by status"
        value={status}
        onChange={(event) => onStatusChange(event.target.value as CameraStatus | 'all')}
        className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="all">All statuses</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
        <option value="unknown">Unknown</option>
      </select>
      <select
        aria-label="Sort cameras"
        value={sort}
        onChange={(event) => onSortChange(event.target.value as CameraSort)}
        className="min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="name">Name</option>
        <option value="distance">Distance</option>
        <option value="recent">Recently viewed</option>
      </select>
      <label
        className={`flex min-h-11 items-center gap-2 text-sm text-slate-700 ${isSheet ? '' : 'col-span-3'}`}
      >
        <input
          type="checkbox"
          checked={mapOnly}
          onChange={(event) => onMapOnlyChange(event.target.checked)}
          className="size-4"
          aria-label="Only cameras in map view"
        />
        Only cameras in map view
      </label>
    </div>
  );

  const body = (
    <>
      <div className="grid gap-2 border-b border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="camera-search">
              Search cameras
            </label>
            <input
              id="camera-search"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Name, road, intersection, or district"
              className="mt-1 w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            />
          </div>
          {isSheet ? (
            <button
              type="button"
              className="relative min-h-11 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              Filters
              {activeFilterCount > 0 ? (
                <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-teal-700 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
        {isSheet ? (filtersOpen ? filters : null) : filters}
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto" style={{ height: '100%' }}>
        {cameras.length === 0 ? (
          <EmptyState
            title="No cameras match"
            detail="Try a different search, district, or status filter."
          />
        ) : useVirtual ? (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((item) => {
              const camera = cameras[item.index];
              if (!camera) {
                return null;
              }
              return (
                <div
                  key={camera.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${item.start}px)`,
                  }}
                >
                  <CameraRow
                    camera={camera}
                    selected={camera.id === selectedId}
                    userLocation={userLocation}
                    onSelect={onSelect}
                    onOpen={onOpen}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          cameras.map((camera) => (
            <CameraRow
              key={camera.id}
              camera={camera}
              selected={camera.id === selectedId}
              userLocation={userLocation}
              onSelect={onSelect}
              onOpen={onOpen}
            />
          ))
        )}
      </div>
    </>
  );

  if (isSheet) {
    return (
      <div className="flex min-h-0 flex-1 flex-col" aria-label="Traffic camera list">
        {body}
      </div>
    );
  }

  return (
    <aside
      className="hidden h-full w-[400px] flex-col border-l border-slate-200 bg-white shadow-lg md:flex"
      aria-label="Traffic camera list"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Cameras</h2>
          <p className="text-xs text-slate-600">{cameras.length} available</p>
        </div>
      </div>
      {body}
    </aside>
  );
}

function CameraThumbnail({ url }: { url: string }) {
  const [src, setSrc] = useState(url);
  const attempts = useRef(0);

  useEffect(() => {
    attempts.current = 0;
    setSrc(url);
  }, [url]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-16 w-24 shrink-0 rounded-md bg-slate-200 object-cover"
      onError={() => {
        if (attempts.current >= 3) {
          return;
        }
        attempts.current += 1;
        window.setTimeout(() => {
          const next = new URL(url, window.location.origin);
          next.searchParams.set('t', String(Date.now()));
          setSrc(`${next.pathname}?${next.searchParams.toString()}`);
        }, 1500);
      }}
    />
  );
}

function CameraRow({
  camera,
  selected,
  userLocation,
  onSelect,
  onOpen,
}: {
  camera: TrafficCamera;
  selected: boolean;
  userLocation: UserLocation | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const distance = userLocation ? formatDistance(haversineKm(userLocation, camera)) : null;
  return (
    <div
      data-selected={selected ? 'true' : 'false'}
      className={`flex w-full gap-3 px-3 py-3 hover:bg-slate-50 ${selected ? 'bg-teal-50' : ''}`}
    >
      <button
        type="button"
        onClick={() => onOpen(camera.id)}
        aria-label={`Open viewer for ${camera.name}`}
        className="min-h-11 shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {camera.thumbnailUrl ? (
          <CameraThumbnail url={camera.thumbnailUrl} />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded-md bg-slate-200 text-xs text-slate-600">
            No image
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={() => onSelect(camera.id)}
        aria-label={`Select ${camera.name}`}
        className="min-h-11 min-w-0 flex-1 text-left hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-teal-700"
      >
        <span className="block truncate font-medium text-slate-900">{camera.name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <StatusBadge status={camera.status} />
          <span>{camera.district ?? 'District unknown'}</span>
          {distance ? <span>{distance}</span> : null}
        </span>
      </button>
    </div>
  );
}
