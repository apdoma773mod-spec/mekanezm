import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'الصفحة مش موجودة | ميكانيزم', robots: { index: false } };

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 30%,#2f6f8f,#0b1b28)', color: '#fff', textAlign: 'center', padding: 20, marginBottom: -150 }}>
      <div>
        <h1 style={{ fontSize: 72, margin: 0, background: 'linear-gradient(135deg,#f6d77a,#a8741a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>404</h1>
        <p style={{ opacity: 0.85 }}>الصفحة اللي بتدوّر عليها مش موجودة — بس المنتجات كلها موجودة 😉</p>
        <a href="/" style={{ display: 'inline-block', margin: 6, padding: '14px 22px', borderRadius: 14, textDecoration: 'none', fontWeight: 800, background: 'var(--gd)', color: '#2a1c04' }}>🛒 المتجر</a>
        <a href="/custom" style={{ display: 'inline-block', margin: 6, padding: '14px 22px', borderRadius: 14, textDecoration: 'none', fontWeight: 800, background: '#ffffff1f', color: '#fff' }}>🛠️ تجهيز منتج بمقاسك</a>
      </div>
    </div>
  );
}
