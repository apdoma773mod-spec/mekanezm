'use client';
export function PrintBtn() {
  return (
    <div className="noprint" style={{ display: 'flex', gap: 8, marginTop: 16 }}>
      <button className="pri" style={{ flex: 1 }} onClick={() => print()}>🖨️ اطبع / احفظ PDF</button>
      <a className="sec" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }} href="/">← رجوع للمتجر</a>
    </div>
  );
}
