import type { CameraQuery, CameraStatus, TrafficCamera } from '@/features/cameras/types';

export function normalizeSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function cameraMatchesQuery(camera: TrafficCamera, query?: string): boolean {
  if (!query) {
    return true;
  }
  const needle = normalizeSearch(query);
  if (!needle) {
    return true;
  }

  const haystack = [camera.name, camera.location, camera.district, camera.id]
    .filter(Boolean)
    .map((value) => normalizeSearch(String(value)))
    .join(' ');

  return haystack.includes(needle);
}

export function cameraInBounds(
  camera: TrafficCamera,
  bounds?: CameraQuery['bounds'],
): boolean {
  if (!bounds) {
    return true;
  }
  return (
    camera.latitude <= bounds.north &&
    camera.latitude >= bounds.south &&
    camera.longitude <= bounds.east &&
    camera.longitude >= bounds.west
  );
}

export function filterCameras(
  cameras: TrafficCamera[],
  params: CameraQuery = {},
): TrafficCamera[] {
  return cameras.filter((camera) => {
    if (params.district && camera.district !== params.district) {
      return false;
    }
    if (params.status && params.status !== 'all' && camera.status !== params.status) {
      return false;
    }
    if (!cameraMatchesQuery(camera, params.query)) {
      return false;
    }
    return cameraInBounds(camera, params.bounds);
  });
}

export function uniqueDistricts(cameras: TrafficCamera[]): string[] {
  return [...new Set(cameras.map((camera) => camera.district).filter(Boolean) as string[])].sort(
    (a, b) => a.localeCompare(b, 'vi'),
  );
}

export function statusLabel(status: CameraStatus): string {
  switch (status) {
    case 'online':
      return 'Online';
    case 'offline':
      return 'Offline';
    default:
      return 'Unknown';
  }
}
