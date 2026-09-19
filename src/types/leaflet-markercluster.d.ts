import type * as L from 'leaflet';

declare module 'leaflet' {
  function markerClusterGroup(options?: {
    chunkedLoading?: boolean;
    showCoverageOnHover?: boolean;
    maxClusterRadius?: number;
  }): L.MarkerClusterGroup;
}

declare module 'leaflet.markercluster';
