'use client';

import dynamic from 'next/dynamic';
import { LoadingState } from '@/components/common/Feedback';
import type { GeoBounds, TrafficCamera, UserLocation } from '@/features/cameras/types';

export const CameraMap = dynamic(() => import('./CameraMapInner'), {
  ssr: false,
  loading: () => <LoadingState label="Loading map" />,
});

export interface CameraMapProps {
  cameras: TrafficCamera[];
  selectedId: string | null;
  userLocation: UserLocation | null;
  onSelect: (id: string) => void;
  onOpen: (id: string) => void;
  onBoundsChange: (bounds: GeoBounds) => void;
  onRequestLocation: () => void;
  locationLoading: boolean;
}
