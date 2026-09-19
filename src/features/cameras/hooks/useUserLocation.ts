import { useCallback, useState } from 'react';
import type { UserLocation } from '@/features/cameras/types';

const PRIMARY_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 15_000,
  maximumAge: 5 * 60_000,
};

const FALLBACK_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20_000,
  maximumAge: 0,
};

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Location is not supported in this browser.');
      return;
    }

    if (!window.isSecureContext) {
      setError(
        'Location needs a secure page (HTTPS or localhost). Open the app at http://localhost:3000.',
      );
      return;
    }

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const position = await getPositionWithFallback();
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setDenied(false);
        setError(null);
      } catch (geoError) {
        applyGeoFailure(geoError, setDenied, setError);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { location, denied, loading, error, requestLocation };
}

async function getPositionWithFallback(): Promise<GeolocationPosition> {
  try {
    return await getCurrentPosition(PRIMARY_OPTIONS);
  } catch (firstError) {
    if (isPermissionDenied(firstError)) {
      throw firstError;
    }
    try {
      return await getCurrentPosition(FALLBACK_OPTIONS);
    } catch (secondError) {
      if (isPermissionDenied(secondError)) {
        throw secondError;
      }
      return await watchPositionOnce(FALLBACK_OPTIONS);
    }
  }
}

function getCurrentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function watchPositionOnce(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeout ?? 20_000;
    let settled = false;
    let timer = 0;
    let watchId = 0;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
      callback();
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        finish(() => resolve(position));
      },
      (error) => {
        finish(() => reject(error));
      },
      options,
    );

    timer = window.setTimeout(() => {
      finish(() =>
        reject(
          Object.assign(new Error('Location timed out'), {
            code: 3,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          }),
        ),
      );
    }, timeoutMs);
  });
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as GeolocationPositionError).code === 1
  );
}

function applyGeoFailure(
  geoError: unknown,
  setDenied: (value: boolean) => void,
  setError: (value: string | null) => void,
): void {
  const code =
    typeof geoError === 'object' && geoError !== null && 'code' in geoError
      ? Number((geoError as GeolocationPositionError).code)
      : NaN;

  if (code === 1) {
    setDenied(true);
    setError('Location permission was denied. Distances are hidden.');
    return;
  }
  if (code === 3) {
    setError(
      'Location timed out. Check that Windows Location is on, then try My location again.',
    );
    return;
  }
  if (code === 2) {
    setError(
      'Your position is unavailable right now. Try again outdoors or with Wi‑Fi location enabled.',
    );
    return;
  }
  setError('Unable to read your current location. Try My location again.');
}
