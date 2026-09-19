import type { CameraQuery, TrafficCamera } from '@/features/cameras/types';
import { filterCameras } from '@/features/cameras/utils/filter';
import type { CameraSnapshot, TrafficCameraProvider } from '@/providers/traffic-camera-provider';

const MOCK_REFRESH = 5;

const MOCK_ROWS: TrafficCamera[] = [
  {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    name: 'Mock — Nguyen Hue - Le Loi',
    location: 'Nguyen Hue - Le Loi',
    district: 'Quận 1',
    latitude: 10.7731,
    longitude: 106.7038,
    status: 'online',
    thumbnailUrl: '/api/cameras/aaaaaaaaaaaaaaaaaaaaaaaa/snapshot',
    source: {
      type: 'image',
      url: '/api/cameras/aaaaaaaaaaaaaaaaaaaaaaaa/snapshot',
      refreshIntervalSeconds: MOCK_REFRESH,
    },
    originalPageUrl:
      'https://abc.com/expandcameraplayer/?camId=aaaaaaaaaaaaaaaaaaaaaaaa&camLocation=Mock%20Nguyen%20Hue&camMode=camera',
    lastUpdatedAt: new Date().toISOString(),
  },
  {
    id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
    name: 'Mock — Dien Bien Phu - Cach Mang Thang Tam',
    location: 'Dien Bien Phu - Cach Mang Thang Tam',
    district: 'Quận 3',
    latitude: 10.7906,
    longitude: 106.6778,
    status: 'online',
    thumbnailUrl: '/api/cameras/bbbbbbbbbbbbbbbbbbbbbbbb/snapshot',
    source: {
      type: 'hls',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    },
    originalPageUrl:
      'https://abc.com/expandcameraplayer/?camId=bbbbbbbbbbbbbbbbbbbbbbbb&camLocation=Mock%20Dien%20Bien%20Phu&camMode=camera',
    lastUpdatedAt: new Date().toISOString(),
  },
  {
    id: 'cccccccccccccccccccccccc',
    name: 'Mock — Quang Trung - Phan Van Tri',
    location: 'Quang Trung - Phan Van Tri',
    district: 'Quận Gò Vấp',
    latitude: 10.8376,
    longitude: 106.6665,
    status: 'offline',
    thumbnailUrl: '/api/cameras/cccccccccccccccccccccccc/snapshot',
    source: {
      type: 'image',
      url: '/api/cameras/cccccccccccccccccccccccc/snapshot',
      refreshIntervalSeconds: MOCK_REFRESH,
    },
    originalPageUrl:
      'https://abc.com/expandcameraplayer/?camId=cccccccccccccccccccccccc&camLocation=Mock%20Quang%20Trung&camMode=camera',
    lastUpdatedAt: '2020-01-01T00:00:00.000Z',
  },
  {
    id: 'dddddddddddddddddddddddd',
    name: 'Mock — Vo Van Kiet - Nguyen Thai Hoc',
    location: 'Vo Van Kiet - Nguyen Thai Hoc',
    district: 'Quận 1',
    latitude: 10.7622,
    longitude: 106.6935,
    status: 'unknown',
    thumbnailUrl: '/api/cameras/dddddddddddddddddddddddd/snapshot',
    source: {
      type: 'embed',
      url: 'https://abc.com/expandcameraplayer/?camId=dddddddddddddddddddddddd&camLocation=Mock%20Vo%20Van%20Kiet&camMode=camera',
    },
    originalPageUrl:
      'https://abc.com/expandcameraplayer/?camId=dddddddddddddddddddddddd&camLocation=Mock%20Vo%20Van%20Kiet&camMode=camera',
  },
  {
    id: 'eeeeeeeeeeeeeeeeeeeeeeee',
    name: 'Mock — Xa Lo Ha Noi - Linh Trung',
    location: 'Xa Lo Ha Noi - Linh Trung',
    district: 'Thủ Đức',
    latitude: 10.8621,
    longitude: 106.7817,
    status: 'online',
    thumbnailUrl: '/api/cameras/eeeeeeeeeeeeeeeeeeeeeeee/snapshot',
    source: {
      type: 'image',
      url: '/api/cameras/eeeeeeeeeeeeeeeeeeeeeeee/snapshot',
      refreshIntervalSeconds: MOCK_REFRESH,
    },
    originalPageUrl:
      'https://abc.com/expandcameraplayer/?camId=eeeeeeeeeeeeeeeeeeeeeeee&camLocation=Mock%20Xa%20Lo%20Ha%20Noi&camMode=camera',
    lastUpdatedAt: new Date().toISOString(),
  },
  {
    id: 'ffffffffffffffffffffffff',
    name: 'Mock — missing-media camera',
    location: 'Unknown intersection',
    district: 'Quận 5',
    latitude: 10.7546,
    longitude: 106.6674,
    status: 'offline',
    originalPageUrl:
      'https://abc.com/expandcameraplayer/?camId=ffffffffffffffffffffffff&camLocation=Mock%20missing&camMode=camera',
  },
];

export const MOCK_CAMERAS: TrafficCamera[] = MOCK_ROWS;

export class MockTrafficCameraProvider implements TrafficCameraProvider {
  readonly name = 'mock' as const;

  constructor(private readonly cameras: TrafficCamera[] = MOCK_CAMERAS) {}

  async getCameras(params?: CameraQuery): Promise<TrafficCamera[]> {
    return filterCameras(this.cameras, params);
  }

  async getCameraById(id: string): Promise<TrafficCamera | null> {
    return this.cameras.find((camera) => camera.id === id) ?? null;
  }

  async getSnapshot(id: string): Promise<CameraSnapshot | null> {
    const camera = await this.getCameraById(id);
    if (!camera?.thumbnailUrl) {
      return null;
    }
    const svg = createMockSnapshotSvg(camera);
    return {
      body: new TextEncoder().encode(svg),
      contentType: 'image/svg+xml; charset=utf-8',
    };
  }
}

export function createMockSnapshotSvg(camera: TrafficCamera): string {
  const status = camera.status.toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <rect width="640" height="360" fill="#0f172a"/>
  <rect x="24" y="24" width="592" height="312" rx="16" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
  <text x="320" y="150" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="22">MOCK CAMERA</text>
  <text x="320" y="190" text-anchor="middle" fill="#7dd3fc" font-family="Arial, sans-serif" font-size="18">${escapeXml(camera.name)}</text>
  <text x="320" y="230" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="16">${status}</text>
</svg>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
