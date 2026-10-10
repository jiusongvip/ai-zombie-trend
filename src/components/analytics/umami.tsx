// Umami (v2) tracking — native <script> tag so it lands in SSR HTML (see
// analytics/plausible.tsx for why). `data-website-id` is read by the script
// via document.currentScript; no init snippet needed. For custom event
// tracking call window.umami?.track(...) from anywhere.
export function Umami({
  src = 'https://analytics.umami.is/script.js',
  websiteId,
}: {
  src?: string;
  websiteId?: string;
}) {
  if (!src || !websiteId) return null;
  return (
    <script
      id="umami-loader"
      src={src}
      async
      defer
      data-website-id={websiteId}
    />
  );
}
