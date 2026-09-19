import type { CameraSort, TrafficCamera, UserLocation } from '@/features/cameras/types';
import { haversineKm } from '@/features/cameras/utils/distance';

export function sortCameras(
  cameras: TrafficCamera[],
  sort: CameraSort,
  options: {
    userLocation?: UserLocation | null;
    recentIds?: string[];
  } = {},
): TrafficCamera[] {
  const copy = [...cameras];

  if (sort === 'distance' && options.userLocation) {
    return copy.sort((a, b) => {
      const da = haversineKm(options.userLocation!, a);
      const db = haversineKm(options.userLocation!, b);
      return da - db || a.name.localeCompare(b.name, 'vi');
    });
  }

  if (sort === 'recent' && options.recentIds?.length) {
    const rank = new Map(options.recentIds.map((id, index) => [id, index]));
    return copy.sort((a, b) => {
      const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.name.localeCompare(b.name, 'vi');
    });
  }

  return copy.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}
