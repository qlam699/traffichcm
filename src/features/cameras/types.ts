export type CameraStatus = 'online' | 'offline' | 'unknown';

export type CameraSource =
  | {
      type: 'image';
      url: string;
      refreshIntervalSeconds?: number;
    }
  | {
      type: 'hls';
      url: string;
    }
  | {
      type: 'embed';
      url: string;
    };

export interface GeoBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TrafficCamera {
  id: string;
  name: string;
  location?: string;
  district?: string;
  latitude: number;
  longitude: number;
  status: CameraStatus;
  thumbnailUrl?: string;
  source?: CameraSource;
  originalPageUrl?: string;
  lastUpdatedAt?: string;
}

export interface CameraQuery {
  bounds?: GeoBounds;
  query?: string;
  district?: string;
  status?: CameraStatus | 'all';
}

export type CameraSort = 'name' | 'distance' | 'recent';

export interface UserLocation {
  latitude: number;
  longitude: number;
}

export interface CameraListResult {
  cameras: TrafficCamera[];
  provider: 'hcmc' | 'mock';
  fetchedAt: string;
  warning?: string;
}
