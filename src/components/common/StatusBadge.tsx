import type { CameraStatus } from '@/features/cameras/types';
import { statusLabel } from '@/features/cameras/utils/filter';

export function StatusBadge({ status }: { status: CameraStatus }) {
  const styles = {
    online: 'bg-emerald-100 text-emerald-900',
    offline: 'bg-slate-200 text-slate-800',
    unknown: 'bg-amber-100 text-amber-900',
  } as const;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      <span aria-hidden="true">{status === 'online' ? '●' : status === 'offline' ? '○' : '?'}</span>
      {statusLabel(status)}
    </span>
  );
}
