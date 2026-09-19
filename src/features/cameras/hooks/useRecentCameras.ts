import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'traffichcm.recentCameraIds';
const LIMIT = 30;

function readIds(): string[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

export function useRecentCameras() {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setRecentIds(readIds());
  }, []);

  const remember = useCallback((id: string) => {
    setRecentIds((current) => {
      const next = [id, ...current.filter((item) => item !== id)].slice(0, LIMIT);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentIds, remember };
}
