// Shown instantly while a store page loads (gray card shapes instead of a blank screen).
export default function Loading() {
  return (
    <main className="page" aria-busy="true" aria-label="جاري التحميل">
      <div className="sk" style={{ height: 28, width: '45%', margin: '10px 0 16px' }} />
      <div className="grid list-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="card" key={i}><div className="sk" style={{ aspectRatio: '1' }} /><div className="sk" style={{ height: 14, margin: '0 14px' }} /><div className="sk" style={{ height: 34, margin: '0 14px', borderRadius: 24 }} /></div>
        ))}
      </div>
    </main>
  );
}
