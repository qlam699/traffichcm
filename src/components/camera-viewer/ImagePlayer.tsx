'use client';

import { useEffect, useState } from 'react';
import { ErrorState, LoadingState } from '@/components/common/Feedback';

const RETRY_MS = 1500;

export function ImagePlayer({
  url,
  title,
  refreshIntervalSeconds = 5,
  autoRefresh,
}: {
  url: string;
  title: string;
  refreshIntervalSeconds?: number;
  autoRefresh: boolean;
}) {
  const [shownSrc, setShownSrc] = useState<string | null>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setShownSrc(null);
    setFailed(false);
    setPendingSrc(withCacheBust(url));
  }, [url]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const intervalMs = Math.max(refreshIntervalSeconds, 5) * 1000;
    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      setPendingSrc(withCacheBust(url));
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefresh, refreshIntervalSeconds, url]);

  useEffect(() => {
    if (!failed || shownSrc) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFailed(false);
      setPendingSrc(withCacheBust(url));
    }, RETRY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [failed, shownSrc, url]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
      {shownSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shownSrc}
          alt={`Traffic camera at ${title}`}
          className="h-full w-full object-contain"
        />
      ) : failed ? (
        <ErrorState
          title="Snapshot unavailable"
          detail="The camera image could not be loaded. Retrying automatically."
          onRetry={() => {
            setFailed(false);
            setPendingSrc(withCacheBust(url));
          }}
        />
      ) : (
        <LoadingState label="Loading snapshot" />
      )}
      {pendingSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={pendingSrc}
          src={pendingSrc}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
          onLoad={() => {
            setShownSrc(pendingSrc);
            setPendingSrc(null);
            setFailed(false);
          }}
          onError={() => {
            setPendingSrc(null);
            if (!shownSrc) {
              setFailed(true);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function withCacheBust(url: string): string {
  const next = new URL(url, window.location.origin);
  next.searchParams.set('t', String(Date.now()));
  return `${next.pathname}?${next.searchParams.toString()}`;
}
