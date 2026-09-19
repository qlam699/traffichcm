export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-slate-600">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600"
        aria-hidden="true"
      />
      <p role="status">{label}</p>
    </div>
  );
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 p-6 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      <p className="max-w-sm text-sm text-slate-600">{detail}</p>
    </div>
  );
}

export function ErrorState({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-medium text-red-800">{title}</p>
      <p className="max-w-sm text-sm text-slate-600">{detail}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
