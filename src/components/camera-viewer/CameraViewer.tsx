'use client';

import { useEffect, useRef, useState } from 'react';
import { EmbedPlayer } from '@/components/camera-viewer/EmbedPlayer';
import { HlsPlayer } from '@/components/camera-viewer/HlsPlayer';
import { ImagePlayer } from '@/components/camera-viewer/ImagePlayer';
import { StatusBadge } from '@/components/common/StatusBadge';
import { useMediaQuery } from '@/features/cameras/hooks/useMediaQuery';
import type { TrafficCamera } from '@/features/cameras/types';
import { statusLabel } from '@/features/cameras/utils/filter';

type OrientationLockType =
  | 'any'
  | 'natural'
  | 'landscape'
  | 'portrait'
  | 'portrait-primary'
  | 'portrait-secondary'
  | 'landscape-primary'
  | 'landscape-secondary';

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLockType) => Promise<void>;
  unlock?: () => void;
};

function getScreenOrientation(): ScreenOrientationWithLock | undefined {
  return screen.orientation as ScreenOrientationWithLock | undefined;
}

async function lockLandscapeOrientation() {
  const orientation = getScreenOrientation();
  if (!orientation?.lock) {
    return;
  }
  await orientation.lock('landscape');
}

function unlockOrientation() {
  try {
    getScreenOrientation()?.unlock?.();
  } catch {
    // Unsupported browsers ignore unlock.
  }
}

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [wideFullscreen, setWideFullscreen] = useState(false);
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
    // isMobile swaps the <dialog> element, so the new one must be opened again.
  }, [onClose, isMobile]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') onPrevious?.();
      if (event.key === 'ArrowRight') onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNext, onPrevious]);

  useEffect(() => {
    if (!wideFullscreen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setWideFullscreen(false);
        unlockOrientation();
        if (document.fullscreenElement) {
          void document.exitFullscreen().catch(() => undefined);
        }
      }
    };

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setWideFullscreen(false);
        unlockOrientation();
      }
    };

    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [wideFullscreen]);

  const exitWideFullscreen = async () => {
    setWideFullscreen(false);
    unlockOrientation();
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignore exit failures.
      }
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const openFullscreen = async () => {
    const node = mediaRef.current;
    if (!node) {
      return;
    }

    if (isMobile) {
      setWideFullscreen(true);
      try {
        await lockLandscapeOrientation();
      } catch {
        // Orientation lock is often blocked; CSS landscape fallback still applies.
      }
      try {
        const requestFs =
          node.requestFullscreen?.bind(node) ??
          (
            node as HTMLElement & {
              webkitRequestFullscreen?: () => Promise<void> | void;
            }
          ).webkitRequestFullscreen?.bind(node);
        await requestFs?.();
      } catch {
        // Overlay still provides widescreen view without native fullscreen.
      }
      return;
    }

    const requestFs =
      node.requestFullscreen?.bind(node) ??
      (
        node as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void> | void;
        }
      ).webkitRequestFullscreen?.bind(node);

    try {
      await requestFs?.();
    } catch {
      // Fullscreen may be denied by the browser.
    }
  };

  const refreshImage = () => {
    setAutoRefresh(true);
    setRefreshKey((value) => value + 1);
  };

  const isImage = camera.source?.type === 'image';

  const media = (
    <div
      ref={mediaRef}
      data-media
      className={isMobile ? 'flex h-full w-full items-center bg-black' : undefined}
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
        <p className="w-full bg-slate-100 p-6 text-center text-slate-700 md:rounded-lg">
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
        <p className="w-full bg-slate-100 p-6 text-center text-slate-700 md:rounded-lg">
          No public image or stream is available for this camera.
        </p>
      )}
    </div>
  );

  if (isMobile) {
    const subtitle = [
      camera.district,
      camera.lastUpdatedAt ? new Date(camera.lastUpdatedAt).toLocaleTimeString() : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return (
      <dialog
        ref={dialogRef}
        className="m-0 h-[100dvh] max-h-none w-full max-w-none border-0 bg-black p-0 text-white open:flex open:flex-col"
        aria-labelledby="camera-viewer-title"
      >
        <div className="flex items-center gap-2 pl-3 pt-[env(safe-area-inset-top)]">
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[camera.status]}`}
          />
          <div className="min-w-0 flex-1">
            <h2
              id="camera-viewer-title"
              className="truncate text-sm font-semibold leading-tight"
            >
              {camera.name}
              <span className="sr-only"> ({statusLabel(camera.status)})</span>
            </h2>
            {subtitle ? (
              <p className="truncate text-[11px] leading-tight text-white/60">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`${toolClass} w-11 shrink-0`}
            aria-label="Close camera viewer"
          >
            <Icon d={ICONS.close} />
          </button>
        </div>

        <div className="min-h-0 flex-1">{media}</div>

        <div className="grid auto-cols-fr grid-flow-col border-t border-white/10 pb-[env(safe-area-inset-bottom)]">
          <ToolButton
            label="Prev"
            icon={ICONS.prev}
            onClick={onPrevious}
            disabled={!onPrevious}
          />
          {isImage ? (
            <>
              <ToolButton label="Refresh" icon={ICONS.refresh} onClick={refreshImage} />
              <ToolButton
                label={autoRefresh ? 'Pause' : 'Auto'}
                icon={autoRefresh ? ICONS.pause : ICONS.play}
                onClick={() => setAutoRefresh((value) => !value)}
                pressed={!autoRefresh}
              />
            </>
          ) : null}
          <ToolButton
            label={copied ? 'Copied' : 'Share'}
            icon={copied ? ICONS.check : ICONS.link}
            onClick={() => void copyLink()}
          />
          {camera.originalPageUrl ? (
            <a
              className={toolClass}
              href={camera.originalPageUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Open original source"
            >
              <Icon d={ICONS.external} />
              <span className="text-[10px] leading-none">Source</span>
            </a>
          ) : null}
          <ToolButton
            label="Next"
            icon={ICONS.next}
            onClick={onNext}
            disabled={!onNext}
          />
        </div>
      </dialog>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(920px,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/50"
      aria-labelledby="camera-viewer-title"
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-1">
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
            onClick={() => {
              void exitWideFullscreen();
              onClose();
            }}
            className="min-h-11 min-w-11 rounded-md px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
            aria-label="Close camera viewer"
          >
            Close
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
        {media}

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
              <a
                className={buttonClass}
                href={camera.source.url}
                target="_blank"
                rel="noreferrer"
              >
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
          <button
            type="button"
            className={buttonClass}
            onClick={onPrevious}
            disabled={!onPrevious}
          >
            Previous
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={onNext}
            disabled={!onNext}
          >
            Next
          </button>
        </div>
      </div>
    </dialog>
  );
}

const STATUS_DOT = {
  online: 'bg-emerald-400',
  offline: 'bg-slate-500',
  unknown: 'bg-amber-400',
} as const;

const ICONS = {
  close: 'M6 6l12 12M18 6L6 18',
  prev: 'M15 18l-6-6 6-6',
  next: 'M9 18l6-6-6-6',
  refresh: 'M20 12a8 8 0 1 1-2.34-5.66L20 8.5M20 3.5v5h-5',
  pause: 'M9 5v14M15 5v14',
  play: 'M7 5l12 7-12 7z',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2',
  check: 'M5 13l4 4L19 7',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
} as const;

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function ToolButton({
  label,
  icon,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      className={toolClass}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
    >
      <Icon d={icon} />
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

const toolClass =
  'flex h-12 flex-col items-center justify-center gap-1 text-white/90 active:bg-white/10 disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-teal-400';

const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-center text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700';
