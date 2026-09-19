import { getEnv } from '@/lib/env';
import { HcmcTrafficCameraProvider } from '@/providers/hcmc-traffic-provider';
import { MockTrafficCameraProvider } from '@/providers/mock-traffic-provider';
import type { TrafficCameraProvider } from '@/providers/traffic-camera-provider';

let cached: TrafficCameraProvider | null = null;

export function getTrafficCameraProvider(): TrafficCameraProvider {
  if (cached) {
    return cached;
  }

  const env = getEnv();
  cached =
    env.TRAFFIC_CAMERA_PROVIDER === 'mock'
      ? new MockTrafficCameraProvider()
      : new HcmcTrafficCameraProvider({
          baseUrl: env.TRAFFIC_CAMERA_BASE_URL,
          timeoutMs: env.UPSTREAM_REQUEST_TIMEOUT_MS,
          cacheTtlSeconds: env.CAMERA_METADATA_CACHE_TTL_SECONDS,
        });

  return cached;
}

export function resetTrafficCameraProvider(): void {
  cached = null;
}
