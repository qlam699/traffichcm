import type { CameraQuery, TrafficCamera } from '@/features/cameras/types';

export interface CameraSnapshot {
  body: Uint8Array;
  contentType: string;
}

export interface TrafficCameraProvider {
  readonly name: 'hcmc' | 'mock';
  getCameras(params?: CameraQuery): Promise<TrafficCamera[]>;
  getCameraById(id: string): Promise<TrafficCamera | null>;
  getSnapshot(id: string): Promise<CameraSnapshot | null>;
}
