import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="card" style={{ margin: '40px auto', maxWidth: 480, textAlign: 'center' }}>
      <h2 style={{ marginTop: 0 }}>الصفحة دي مش موجودة</h2>
      <Link href="/" className="primary" style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 12, textDecoration: 'none' }}>
        🏠 الرئيسية
      </Link>
    </div>
  );
}
