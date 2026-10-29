'use client';

/** Last resort: the whole app failed to render (e.g. the layout itself). Plain HTML, no app styles needed. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'sans-serif', padding: 24, textAlign: 'center' }}>
        <h2>ميكانيزم مش شغال دلوقتي</h2>
        <p>اعمل تحديث للصفحة. لو فضلت المشكلة، قول لعبده.</p>
        <button type="button" onClick={() => reset()}>
          🔄 جرّب تاني
        </button>
      </body>
    </html>
  );
}
