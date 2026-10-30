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
