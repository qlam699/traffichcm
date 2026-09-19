export function EmbedPlayer({ url, title }: { url: string; title: string }) {
  return (
    <iframe
      src={url}
      title={`${title} official camera page`}
      className="aspect-video w-full rounded-lg border border-slate-200 bg-white"
      referrerPolicy="no-referrer"
    />
  );
}
