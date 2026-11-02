// Google Analytics + Facebook Pixel events (no-ops until the tags have loaded).
type W = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };

export function ev(ga: string, fb: string, gaData: Record<string, unknown> = {}, fbData: Record<string, unknown> = {}) {
  try {
    const w = window as W;
    w.gtag?.('event', ga, gaData);
    w.fbq?.('track', fb, fbData);
  } catch { /* blocked */ }
}

export const evProduct = (ga: string, fb: string, p: { id: string; name: string }) =>
  ev(ga, fb, { items: [{ item_id: p.id, item_name: p.name }] }, { content_ids: [p.id], content_name: p.name, content_type: 'product' });

let reported = 0;
/** Send the first few errors of a page to /api/log so problems on customers' phones are seen on the server. */
export function reportError(msg: string, stack?: string) {
  if (reported++ >= 3 || !msg || /ResizeObserver|^Script error\.?$/.test(msg)) return;
  try { navigator.sendBeacon('/api/log', JSON.stringify({ msg: msg.slice(0, 300), url: location.href.slice(0, 300), stack: stack?.slice(0, 1200), ua: navigator.userAgent.slice(0, 200) })); } catch { /* */ }
}
