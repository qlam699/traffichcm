import { useQuery } from '@tanstack/react-query';
import { cameraListResultSchema } from '@/features/cameras/schemas/camera';
import type { CameraListResult, CameraQuery } from '@/features/cameras/types';

async function fetchCameras(params: CameraQuery = {}): Promise<CameraListResult> {
  const search = new URLSearchParams();
  if (params.query) search.set('query', params.query);
  if (params.district) search.set('district', params.district);
  if (params.status && params.status !== 'all') search.set('status', params.status);
  if (params.bounds) {
    search.set('north', String(params.bounds.north));
    search.set('south', String(params.bounds.south));
    search.set('east', String(params.bounds.east));
    search.set('west', String(params.bounds.west));
  }

  const response = await fetch(`/api/cameras?${search.toString()}`, {
    cache: 'no-store',
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof json === 'object' && json && 'error' in json
        ? String((json as { error: unknown }).error)
        : 'Camera list is currently unavailable.';
    throw new Error(message);
  }
  return cameraListResultSchema.parse(json);
}

export function useCameras(params: CameraQuery = {}) {
  return useQuery({
    queryKey: ['cameras', params],
    queryFn: () => fetchCameras(params),
  });
}
