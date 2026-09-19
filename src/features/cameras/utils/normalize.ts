import { trafficCameraSchema } from '@/features/cameras/schemas/camera';
import type { TrafficCamera } from '@/features/cameras/types';
import {
  buildOriginalPageUrl,
  detectCameraSource,
  mapCameraStatus,
  parseWktPoint,
  toIsoDate,
} from '@/features/cameras/utils/source';

export interface UpstreamCameraRow {
  CamId?: unknown;
  Id?: unknown;
  Title?: unknown;
  DisplayName?: unknown;
  Location?: unknown;
  Disctrict?: unknown;
  District?: unknown;
  CamStatus?: unknown;
  VideoUrl?: unknown;
  VideoStreaming?: unknown;
  SnapshotUrl?: unknown;
  ModifiedDate?: unknown;
  Code?: unknown;
}

export function normalizeCameraRow(
  row: UpstreamCameraRow,
  options: { baseUrl: string; snapshotPathForId: (id: string) => string },
): TrafficCamera | null {
  const id = typeof row.CamId === 'string' ? row.CamId : typeof row.Id === 'string' ? row.Id : null;
  if (!id) {
    return null;
  }

  const name =
    (typeof row.DisplayName === 'string' && row.DisplayName.trim()) ||
    (typeof row.Title === 'string' && row.Title.trim()) ||
    (typeof row.Code === 'string' && row.Code.trim()) ||
    `Camera ${id}`;

  const point = parseWktPoint(row.Location);
  if (!point) {
    return null;
  }

  const lastUpdatedAt = toIsoDate(row.ModifiedDate);
  const originalPageUrl = buildOriginalPageUrl(options.baseUrl, id, name);
  const snapshotPath = options.snapshotPathForId(id);
  const source = detectCameraSource({
    id,
    videoUrl: typeof row.VideoUrl === 'string' ? row.VideoUrl : null,
    videoStreaming: row.VideoStreaming,
    snapshotPath,
    originalPageUrl,
  });

  const district =
    (typeof row.Disctrict === 'string' && row.Disctrict) ||
    (typeof row.District === 'string' && row.District) ||
    undefined;

  const camera: TrafficCamera = {
    id,
    name,
    location: name,
    district,
    latitude: point.latitude,
    longitude: point.longitude,
    status: mapCameraStatus(row.CamStatus, lastUpdatedAt),
    thumbnailUrl: snapshotPath,
    source,
    originalPageUrl,
    lastUpdatedAt,
  };

  const parsed = trafficCameraSchema.safeParse(camera);
  return parsed.success ? parsed.data : null;
}
