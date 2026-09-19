'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export type SheetSnap = 'peek' | 'half' | 'expanded';

const SNAP_HEIGHT: Record<SheetSnap, string> = {
  peek: '5.5rem',
  half: '48dvh',
  expanded: '88dvh',
};

const SNAP_ORDER: SheetSnap[] = ['peek', 'half', 'expanded'];

export function BottomSheet({
  snap,
  onSnapChange,
  children,
  title,
  subtitle,
}: {
  snap: SheetSnap;
  onSnapChange: (snap: SheetSnap) => void;
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  const startY = useRef(0);
  const startSnap = useRef<SheetSnap>(snap);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    startSnap.current = snap;
  }, [snap]);

  const moveSnap = useCallback(
    (deltaY: number) => {
      const index = SNAP_ORDER.indexOf(startSnap.current);
      if (deltaY > 48 && index > 0) {
        onSnapChange(SNAP_ORDER[index - 1]!);
        return;
      }
      if (deltaY < -48 && index < SNAP_ORDER.length - 1) {
        onSnapChange(SNAP_ORDER[index + 1]!);
      }
    },
    [onSnapChange],
  );

  return (
    <section
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[1100] flex max-h-[92dvh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-[0_-8px_30px_rgb(15_23_42_/_0.18)] md:hidden"
      style={{
        height: SNAP_HEIGHT[snap],
        transition: dragging ? 'none' : 'height 200ms ease',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Camera list sheet"
    >
      <div
        className="flex shrink-0 cursor-grab flex-col items-center touch-none active:cursor-grabbing"
        onPointerDown={(event) => {
          startY.current = event.clientY;
          startSnap.current = snap;
          setDragging(true);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => {
          if (!dragging) {
            return;
          }
          setDragging(false);
          moveSnap(event.clientY - startY.current);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <button
          type="button"
          className="flex w-full flex-col items-center gap-2 px-4 pb-2 pt-2"
          aria-label={`Camera sheet, ${snap} height. Drag to resize.`}
          onClick={() => {
            const index = SNAP_ORDER.indexOf(snap);
            onSnapChange(SNAP_ORDER[(index + 1) % SNAP_ORDER.length]!);
          }}
        >
          <span className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden="true" />
          <span className="flex w-full items-center justify-between gap-3 text-left">
            <span>
              <span className="block text-sm font-semibold text-slate-900">{title}</span>
              {subtitle ? (
                <span className="block text-xs text-slate-600">{subtitle}</span>
              ) : null}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {snap === 'peek' ? 'Peek' : snap === 'half' ? 'Half' : 'Full'}
            </span>
          </span>
        </button>
      </div>

      <div
        className={`min-h-0 flex-1 flex-col ${snap === 'peek' ? 'hidden' : 'flex'}`}
      >
        {children}
      </div>
    </section>
  );
}
