'use client';

import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import { ErrorState, LoadingState } from '@/components/common/Feedback';

export function HlsPlayer({ url, title }: { url: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let hls: Hls | null = null;
    setError(null);
    setLoading(true);

    const onError = (message: string) => {
      setLoading(false);
      setError(message);
    };

    video.muted = true;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      const onLoaded = () => setLoading(false);
      const onVideoError = () => onError('This HLS playlist could not be played.');
      video.addEventListener('loadeddata', onLoaded);
      video.addEventListener('error', onVideoError);
      void video.play().catch(() => undefined);
      return () => {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('error', onVideoError);
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, maxBufferLength: 10 });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        void video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          onError('The live stream failed. The playlist may have expired.');
        }
      });
      return () => {
        hls?.destroy();
        video.pause();
        video.removeAttribute('src');
        video.load();
      };
    }

    onError('This browser does not support HLS playback.');
    return () => {
      video.pause();
    };
  }, [url]);

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg bg-slate-900">
      {loading && !error ? (
        <div className="absolute inset-0">
          <LoadingState label="Loading stream" />
        </div>
      ) : null}
      {error ? <ErrorState title="Stream unavailable" detail={error} /> : null}
      <video
        ref={videoRef}
        className={`h-full w-full ${error ? 'hidden' : ''}`}
        controls
        playsInline
        muted
        aria-label={`${title} live stream`}
      />
    </div>
  );
}
