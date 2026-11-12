/** Shared by the global barcode router and the windows that take a scanned code (kept apart so imports do not loop). */
export const SCAN_EVENT = 'mk:scan-add';
/** How many sale/purchase/quote windows are open right now. */
export const scanTargets = { tx: 0 };
