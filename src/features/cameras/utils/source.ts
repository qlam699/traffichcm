const POINT_PATTERN = /POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i;
const DEMO_HLS_HOST = 'd2zihajmogu5jn.cloudfront.net';
const HLS_ALLOWLIST = new Set(['camera.thongtingiaothong.vn']);
export const IMAGE_REFRESH_SECONDS = 5;
export const STALE_OFFLINE_MINUTES = 5;

export function parseWktPoint(value: unknown): { latitude: number; longitude: number } | null {
  if (typeof value === 'string') {
    return parsePointString(value);
  }

  if (value && typeof value === 'object' && 'Rows' in value) {
    const rows = (value as { Rows?: Array<Record<string, unknown>> }).Rows;
    const shape = rows?.[0]?.Shape;
    if (typeof shape === 'string') {
      return parsePointString(shape);
    }
  }

  return null;
}

function parsePointString(value: string): { latitude: number; longitude: number } | null {
  const match = POINT_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}

export function detectCameraSource(input: {
  id: string;
  videoUrl?: string | null;
  videoStreaming?: unknown;
  snapshotPath: string;
  originalPageUrl: string;
}): { type: 'image' | 'hls' | 'embed'; url: string; refreshIntervalSeconds?: number } {
  const hlsUrl = sanitizeHlsUrl(input.videoUrl, input.videoStreaming);
  if (hlsUrl) {
    return { type: 'hls', url: hlsUrl };
  }

  if (input.snapshotPath) {
    return {
      type: 'image',
      url: input.snapshotPath,
      refreshIntervalSeconds: IMAGE_REFRESH_SECONDS,
    };
  }

  return { type: 'embed', url: input.originalPageUrl };
}

export function sanitizeHlsUrl(videoUrl: unknown, videoStreaming: unknown): string | null {
  if (!isTruthyStreaming(videoStreaming) || typeof videoUrl !== 'string') {
    return null;
  }

  let url: URL;
  try {
    url = new URL(videoUrl);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:') {
    return null;
  }
  if (url.hostname === DEMO_HLS_HOST) {
    return null;
  }
  if (!HLS_ALLOWLIST.has(url.hostname)) {
    return null;
  }
  if (!url.pathname.endsWith('.m3u8') && !url.pathname.includes('.m3u8')) {
    return null;
  }
  return url.toString();
}

function isTruthyStreaming(value: unknown): boolean {
  return value === 1 || value === true || value === '1' || value === 'true';
}

export function toIsoDate(value: unknown): string | undefined {
  if (typeof value !== 'string' && !(value instanceof Date) && typeof value !== 'number') {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date.toISOString();
}

export function mapCameraStatus(
  status: unknown,
  lastUpdatedAt?: string,
  now = Date.now(),
): 'online' | 'offline' | 'unknown' {
  if (status === 'UP' || status === 'online') {
    return 'online';
  }

  if (lastUpdatedAt) {
    const updated = new Date(lastUpdatedAt).getTime();
    if (!Number.isNaN(updated) && now - updated <= STALE_OFFLINE_MINUTES * 60 * 1000) {
      return 'unknown';
    }
  }

  if (!status) {
    return 'unknown';
  }
  return 'offline';
}

export function buildOriginalPageUrl(baseUrl: string, id: string, name: string): string {
  const origin = new URL(baseUrl);
  const url = new URL('/expandcameraplayer/', origin);
  url.searchParams.set('camId', id);
  url.searchParams.set('camLocation', name);
  url.searchParams.set('camMode', 'camera');
  return url.toString();
}
