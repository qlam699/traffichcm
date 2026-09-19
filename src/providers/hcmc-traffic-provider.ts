import { extractSearchQueryRows, parseAjaxPro } from '@/lib/ajaxpro';
import { TtlCache } from '@/lib/cache';
import {
  fetchUpstream,
  fetchUpstreamWithRetry,
  HttpError,
  readLimitedBuffer,
  readLimitedText,
} from '@/lib/http-client';
import { logger } from '@/lib/logger';
import type { CameraQuery, TrafficCamera } from '@/features/cameras/types';
import { filterCameras } from '@/features/cameras/utils/filter';
import { normalizeCameraRow } from '@/features/cameras/utils/normalize';
import type { CameraSnapshot, TrafficCameraProvider } from '@/providers/traffic-camera-provider';

const CAMERA_PATH = '/root/vdms/tangthu/data/layerdata/camera';
const SEARCH_ENDPOINT = '/ajaxpro/VDMS.Web.Library.AJAX.FolderAjax,VDMS.Web.Library.ashx';
const MAX_METADATA_BYTES = 8 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 1_500_000;
const SNAPSHOT_CACHE_MS = 3_000;

const SEARCH_BODY = JSON.stringify({
  path: CAMERA_PATH,
  isInTree: false,
  searchKey: '',
  layer: ['CAMERA'],
  detail: true,
  page: 0,
  limit: -1,
  filterQuery: ['Publish:true'],
  sortby: null,
  returnFields: [
    'CamId',
    'Code',
    'Location',
    'SnapshotUrl',
    'CamType',
    'Disctrict',
    'Publish',
    'ManagementUnit',
    'CamStatus',
    'PTZ',
    'Angle',
  ],
});

interface HcmcProviderOptions {
  baseUrl: string;
  timeoutMs: number;
  cacheTtlSeconds: number;
}

export class HcmcTrafficCameraProvider implements TrafficCameraProvider {
  readonly name = 'hcmc' as const;
  private readonly cache: TtlCache<TrafficCamera[]>;
  private readonly sessionCache: TtlCache<string>;
  private readonly snapshotCache: TtlCache<CameraSnapshot>;
  private readonly snapshotInflight = new Map<string, Promise<CameraSnapshot>>();
  private readonly allowedHosts: string[];

  constructor(private readonly options: HcmcProviderOptions) {
    this.cache = new TtlCache<TrafficCamera[]>(options.cacheTtlSeconds * 1000);
    this.sessionCache = new TtlCache<string>(Math.max(options.cacheTtlSeconds, 120) * 1000);
    this.snapshotCache = new TtlCache<CameraSnapshot>(SNAPSHOT_CACHE_MS);
    this.allowedHosts = [new URL(options.baseUrl).hostname];
  }

  async getCameras(params?: CameraQuery): Promise<TrafficCamera[]> {
    const cameras = await this.loadCameras();
    return filterCameras(cameras, params);
  }

  async getCameraById(id: string): Promise<TrafficCamera | null> {
    const cameras = await this.loadCameras();
    return cameras.find((camera) => camera.id === id) ?? null;
  }

  async getSnapshot(id: string): Promise<CameraSnapshot | null> {
    const cached = this.snapshotCache.get(id);
    if (cached) {
      return cached;
    }

    const inflight = this.snapshotInflight.get(id);
    if (inflight) {
      return inflight;
    }

    const pending = this.loadSnapshot(id)
      .then((snapshot) => {
        this.snapshotCache.set(id, snapshot);
        return snapshot;
      })
      .finally(() => {
        this.snapshotInflight.delete(id);
      });

    this.snapshotInflight.set(id, pending);
    return pending;
  }

  private async loadCameras(): Promise<TrafficCamera[]> {
    const cached = this.cache.get('cameras');
    if (cached) {
      return cached;
    }

    const cookies = await this.getAnonymousSession();
    const response = await fetchUpstream(new URL(SEARCH_ENDPOINT, this.options.baseUrl).toString(), {
      method: 'POST',
      timeoutMs: this.options.timeoutMs,
      allowedHosts: this.allowedHosts,
      maxBytes: MAX_METADATA_BYTES,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-AjaxPro-Method': 'SearchQuery',
        Referer: new URL('/Map.aspx', this.options.baseUrl).toString(),
        Cookie: cookies,
      },
      body: SEARCH_BODY,
    });

    if (!response.ok) {
      throw new HttpError('Camera metadata request failed', 502);
    }

    const text = await readLimitedText(response, MAX_METADATA_BYTES);
    if (text.includes('"User is not authenticated"')) {
      this.sessionCache.clear();
      throw new HttpError('Official camera catalog requires an anonymous public session', 502);
    }

    const parsed = parseAjaxPro(text);
    const rows = extractSearchQueryRows(parsed);
    const cameras = rows
      .map((row) =>
        normalizeCameraRow(row, {
          baseUrl: this.options.baseUrl,
          snapshotPathForId: (cameraId) => `/api/cameras/${cameraId}/snapshot`,
        }),
      )
      .filter((camera): camera is TrafficCamera => camera !== null);

    if (cameras.length === 0) {
      logger.warn('HCMC provider returned no cameras with coordinates');
    }

    this.cache.set('cameras', cameras);
    return cameras;
  }

  private async getAnonymousSession(): Promise<string> {
    const cached = this.sessionCache.get('cookie');
    if (cached) {
      return cached;
    }

    const response = await fetchUpstream(new URL('/Map.aspx', this.options.baseUrl).toString(), {
      method: 'GET',
      timeoutMs: this.options.timeoutMs,
      allowedHosts: this.allowedHosts,
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new HttpError('Unable to open the official traffic map', 502);
    }

    const cookies = readSetCookies(response);
    if (!cookies) {
      throw new HttpError('Official map did not issue a public session', 502);
    }

    this.sessionCache.set('cookie', cookies);
    return cookies;
  }

  private async loadSnapshot(id: string): Promise<CameraSnapshot> {
    try {
      return await this.fetchSnapshotBytes(id);
    } catch (error) {
      this.sessionCache.clear();
      logger.warn('Retrying camera snapshot after clearing the anonymous session');
      try {
        return await this.fetchSnapshotBytes(id);
      } catch {
        throw error;
      }
    }
  }

  private async fetchSnapshotBytes(id: string): Promise<CameraSnapshot> {
    const cookies = await this.getAnonymousSession();
    const upstream = new URL('/render/ImageHandler.ashx', this.options.baseUrl);
    upstream.searchParams.set('id', id);

    const response = await fetchUpstreamWithRetry(upstream.toString(), {
      method: 'GET',
      timeoutMs: this.options.timeoutMs,
      allowedHosts: this.allowedHosts,
      maxBytes: MAX_SNAPSHOT_BYTES,
      headers: {
        Referer: new URL('/Map.aspx', this.options.baseUrl).toString(),
        Accept: 'image/jpeg,image/*,*/*',
        Cookie: cookies,
      },
    });

    if (!response.ok) {
      throw new HttpError('Snapshot is not available', 502);
    }

    const contentType = response.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      throw new HttpError('Snapshot is not available', 502);
    }

    const body = await readLimitedBuffer(response, MAX_SNAPSHOT_BYTES);
    if (body.byteLength === 0) {
      throw new HttpError('Snapshot is empty', 502);
    }

    return { body, contentType };
  }
}

function readSetCookies(response: Response): string | null {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const raw = headers.getSetCookie?.() ?? [];
  const fallback = response.headers.get('set-cookie');
  const parts = raw.length > 0 ? raw : fallback ? [fallback] : [];
  const pairs = parts
    .map((cookie) => cookie.split(';')[0]?.trim())
    .filter((pair): pair is string => typeof pair === 'string' && pair.length > 0);

  return pairs.length > 0 ? pairs.join('; ') : null;
}
