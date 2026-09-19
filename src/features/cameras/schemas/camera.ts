import { z } from 'zod';

export const geoBoundsSchema = z.object({
  north: z.number().gte(-90).lte(90),
  south: z.number().gte(-90).lte(90),
  east: z.number().gte(-180).lte(180),
  west: z.number().gte(-180).lte(180),
});

export const cameraStatusSchema = z.enum(['online', 'offline', 'unknown']);

export const cameraSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('image'),
    url: z.string().min(1),
    refreshIntervalSeconds: z.number().positive().optional(),
  }),
  z.object({
    type: z.literal('hls'),
    url: z.string().min(1),
  }),
  z.object({
    type: z.literal('embed'),
    url: z.string().min(1),
  }),
]);

export const trafficCameraSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string().optional(),
  district: z.string().optional(),
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180),
  status: cameraStatusSchema,
  thumbnailUrl: z.string().optional(),
  source: cameraSourceSchema.optional(),
  originalPageUrl: z.string().optional(),
  lastUpdatedAt: z.string().optional(),
});

export const cameraListResultSchema = z.object({
  cameras: z.array(trafficCameraSchema),
  provider: z.enum(['hcmc', 'mock']),
  fetchedAt: z.string(),
  warning: z.string().optional(),
});

export const cameraQuerySchema = z.object({
  query: z.string().max(200).optional(),
  district: z.string().max(80).optional(),
  status: z.enum(['online', 'offline', 'unknown', 'all']).optional(),
  north: z.coerce.number().optional(),
  south: z.coerce.number().optional(),
  east: z.coerce.number().optional(),
  west: z.coerce.number().optional(),
});

export const CAMERA_ID_PATTERN = /^[a-f0-9]{24}$/i;

export function isCameraId(value: string): boolean {
  return CAMERA_ID_PATTERN.test(value);
}
