'use client';

import { useEffect, useRef, useState } from 'react';
import { EmbedPlayer } from '@/components/camera-viewer/EmbedPlayer';
import { HlsPlayer } from '@/components/camera-viewer/HlsPlayer';
import { ImagePlayer } from '@/components/camera-viewer/ImagePlayer';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMediaQuery } from '@/features/cameras/hooks/useMediaQuery';
import type { TrafficCamera } from '@/features/cameras/types';

export function CameraViewer({
  camera,
  onClose,
  onPrevious,
  onNext,
}: {
  camera: TrafficCamera;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const shareUrl =
    typeof window === 'undefined'
      ? `/camera/${camera.id}`
      : `${window.location.origin}/camera/${camera.id}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    const onCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onPrevious?.();
      if (event.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onPrevious]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const openFullscreen = () => {
    const node = dialogRef.current?.querySelector('[data-media]');
    if (node && 'requestFullscreen' in node) {
      void (node as HTMLElement).requestFullscreen();
    }
  };

  const refreshImage = () => {
    setAutoRefresh(true);
    setRefreshKey((value) => value + 1);
  };

  return (
    <dialog
      ref={dialogRef}
      className={
        isMobile
          ? 'm-0 h-[100dvh] w-full max-w-none border-0 bg-white p-0 text-slate-900 open:flex open:flex-col'
          : 'm-auto w-[min(920px,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50'
      }
      aria-labelledby="camera-viewer-title"
    >
      <div
        className={`flex items-start justify-between gap-3 border-b border-slate-200 ${
          isMobile
            ? 'px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]'
            : 'px-5 py-1'
        }`}
      >
        <div className="min-w-0">
          <h2 id="camera-viewer-title" className="truncate text-lg font-semibold">
            {camera.name}
          </h2>
          <p className="truncate text-sm text-slate-600">
            {camera.district ?? 'District unknown'}
            {camera.lastUpdatedAt
              ? ` · Updated ${new Date(camera.lastUpdatedAt).toLocaleString()}`
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <StatusBadge status={camera.status} />
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            aria-label="Close camera viewer"
          >
            Close
          </button>
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 space-y-4 overflow-auto ${isMobile ? 'p-4 pb-[max(1rem,env(safe-area-inset-bottom))]' : 'p-5'}`}
      >
        <div
          ref={mediaRef}
          data-media
          onTouchStart={(event) => {
            touchStartX.current = event.changedTouches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            const end = event.changedTouches[0]?.clientX;
            touchStartX.current = null;
            if (start == null || end == null) {
              return;
            }
            const delta = end - start;
            if (delta > 60) {
              onPrevious?.();
            } else if (delta < -60) {
              onNext?.();
            }
          }}
        >
          {camera.status === 'offline' && !camera.source ? (
            <p className="rounded-lg bg-slate-100 p-6 text-center text-slate-700">
              This camera is offline and has no public media source.
            </p>
          ) : camera.source?.type === 'hls' ? (
            <HlsPlayer url={camera.source.url} title={camera.name} />
          ) : camera.source?.type === 'embed' ? (
            <EmbedPlayer url={camera.source.url} title={camera.name} />
          ) : camera.source?.type === 'image' ? (
            <ImagePlayer
              key={refreshKey}
              url={camera.source.url}
              title={camera.name}
              refreshIntervalSeconds={camera.source.refreshIntervalSeconds}
              autoRefresh={autoRefresh}
            />
          ) : (
            <p className="rounded-lg bg-slate-100 p-6 text-center text-slate-700">
              No public image or stream is available for this camera.
            </p>
          )}
        </div>

        {isMobile ? (
          <div className="grid gap-2">
            <div className="grid grid-cols-3 gap-2">
              {camera.source?.type === 'image' ? (
                <button type="button" className={buttonClass} onClick={refreshImage}>
                  Refresh
                </button>
              ) : (
                <span />
              )}
              <button type="button" className={buttonClass} onClick={() => void copyLink()}>
                {copied ? 'Copied' : 'Share'}
              </button>
              <button
                type="button"
                className={buttonClass}
                aria-expanded={moreOpen}
                onClick={() => setMoreOpen((value) => !value)}
              >
                More
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={buttonClass} onClick={onPrevious} disabled={!onPrevious}>
                Previous
              </button>
              <button type="button" className={buttonClass} onClick={onNext} disabled={!onNext}>
                Next
              </button>
            </div>
            {moreOpen ? (
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                {camera.source?.type === 'image' ? (
                  <button
                    type="button"
                    className={buttonClass}
                    onClick={() => setAutoRefresh((value) => !value)}
                  >
                    {autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                  </button>
                ) : null}
                {camera.originalPageUrl ? (
                  <a
                    className={buttonClass}
                    href={camera.originalPageUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original source
                  </a>
                ) : null}
                <button type="button" className={buttonClass} onClick={openFullscreen}>
                  Fullscreen
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {camera.source?.type === 'image' ? (
              <>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => setAutoRefresh((value) => !value)}
                >
                  {autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
                </button>
                <a className={buttonClass} href={camera.source.url} target="_blank" rel="noreferrer">
                  Manual refresh
                </a>
              </>
            ) : null}
            {camera.originalPageUrl ? (
              <a
                className={buttonClass}
                href={camera.originalPageUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open original source
              </a>
            ) : null}
            <button type="button" className={buttonClass} onClick={() => void copyLink()}>
              {copied ? 'Link copied' : 'Copy camera link'}
            </button>
            <button type="button" className={buttonClass} onClick={openFullscreen}>
              Fullscreen
            </button>
            <button type="button" className={buttonClass} onClick={onPrevious} disabled={!onPrevious}>
              Previous
            </button>
            <button type="button" className={buttonClass} onClick={onNext} disabled={!onNext}>
              Next
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
}

const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
