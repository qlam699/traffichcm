import { useQuery } from '@tanstack/react-query';
import { trafficCameraSchema } from '@/features/cameras/schemas/camera';
import type { TrafficCamera } from '@/features/cameras/types';

export function useCamera(id: string | null) {
  return useQuery({
    queryKey: ['camera', id],
    enabled: Boolean(id),
    queryFn: async (): Promise<TrafficCamera> => {
      const response = await fetch(`/api/cameras/${id}`, { cache: 'no-store' });
      const json: unknown = await response.json();
      if (response.status === 404) {
        throw new Error('This camera could not be found.');
      }
      if (!response.ok) {
        throw new Error('Camera details are currently unavailable.');
      }
      return trafficCameraSchema.parse(json);
    },
  });
}
