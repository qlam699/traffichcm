export function EmbedPlayer({ url, title }: { url: string; title: string }) {
  return (
    <iframe
      src={url}
      title={`${title} official camera page`}
      className="aspect-video w-full bg-white md:rounded-lg md:border md:border-slate-200"
      referrerPolicy="no-referrer"
    />
  );
}
