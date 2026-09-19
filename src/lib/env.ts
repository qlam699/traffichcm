import { z } from 'zod';

const envSchema = z.object({
  TRAFFIC_CAMERA_PROVIDER: z.enum(['hcmc', 'mock']).default('hcmc'),
  TRAFFIC_CAMERA_BASE_URL: z
    .string()
    .url()
    .default('https://abc.com'),
  NEXT_PUBLIC_MAP_TILE_URL: z.string().optional().default(''),
  NEXT_PUBLIC_MAP_ATTRIBUTION: z.string().optional().default(''),
  UPSTREAM_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
  CAMERA_METADATA_CACHE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(10)
    .max(600)
    .default(60),
});

export type AppEnv = z.infer<typeof envSchema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (cached) {
    return cached;
  }

  cached = envSchema.parse({
    TRAFFIC_CAMERA_PROVIDER: process.env.TRAFFIC_CAMERA_PROVIDER,
    TRAFFIC_CAMERA_BASE_URL: process.env.TRAFFIC_CAMERA_BASE_URL,
    NEXT_PUBLIC_MAP_TILE_URL: process.env.NEXT_PUBLIC_MAP_TILE_URL,
    NEXT_PUBLIC_MAP_ATTRIBUTION: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION,
    UPSTREAM_REQUEST_TIMEOUT_MS: process.env.UPSTREAM_REQUEST_TIMEOUT_MS,
    CAMERA_METADATA_CACHE_TTL_SECONDS: process.env.CAMERA_METADATA_CACHE_TTL_SECONDS,
  });

  return cached;
}

export function resetEnvCache(): void {
  cached = null;
}

export const DEFAULT_MAP_TILE_URL = 'https://tile.openstreetmap.de/{z}/{x}/{y}.png';

export const DEFAULT_MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
