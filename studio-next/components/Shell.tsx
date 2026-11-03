'use client';
import { useEffect, useState } from 'react';
import { NAV, THEMES } from '@/lib/nav';
import { sb, kv } from '@/lib/supabase';

function Login() {
  const [e, setE] = useState(''), [p, setP] = useState(''), [err, setErr] = useState('');
  return (
    <div className="p" style={{ maxWidth: 380, margin: '12vh auto' }}>
      <h2>دخول ميكانيزم</h2>
      <input placeholder="الإيميل" value={e} onChange={x => setE(x.target.value)} />
      <input placeholder="الباسورد" type="password" value={p} onChange={x => setP(x.target.value)} />
      {err && <p className="mu">{err}</p>}
      <button className="btn" onClick={async () => { const { error } = await sb().auth.signInWithPassword({ email: e, password: p }); if (error) setErr('بيانات غلط'); }}>دخول</button>
    </div>
  );
}

const applyTheme = (k: string) => { const t = THEMES[k]; if (t) Object.entries(t).forEach(([a, b]) => document.documentElement.style.setProperty(a, b)); };

function Theme() {
  return (
    <div className="p"><h2>ثيمات جاهزة</h2>
      {Object.keys(THEMES).map(k => <span key={k} className="th" title={k} style={{ background: THEMES[k]['--bg'], borderColor: THEMES[k]['--a2'] }} onClick={() => { applyTheme(k); kv.set('theme', k); }} />)}
    </div>
  );
}

export default function Shell() {
  const [tab, setTab] = useState('dash'), [user, setUser] = useState<string | null>(null), [ready, setReady] = useState(false);
  useEffect(() => {
    applyTheme(kv.get('theme', 'gold'));
    setTab(kv.get('tab', 'dash'));
    sb().auth.getSession().then(({ data }) => { setUser(data.session?.user.email ?? null); setReady(true); });
    const { data: s } = sb().auth.onAuthStateChange((_e, ses) => setUser(ses?.user.email ?? null));
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => s.subscription.unsubscribe();
  }, []);
  if (!ready) return null;
  if (!user) return <Login />;
  const cur = NAV.find(n => n[0] === tab) ?? NAV[0];
  return (
    <div className="app">
      <nav className="side">
        <div className="logo">ميكانيزم ستوديو</div>
        {NAV.map(([id, ic, nm]) => <button key={id} className={'nb' + (id === tab ? ' on' : '')} onClick={() => { setTab(id); kv.set('tab', id); }}><span>{ic}</span>{nm}</button>)}
      </nav>
      <main className="main">
        <h1>{cur[2]}</h1>
        {tab === 'theme' ? <Theme />
          : tab === 'set' ? <div className="p"><h2>الحساب</h2><p className="mu">{user}</p><button className="btn" onClick={() => sb().auth.signOut()}>خروج</button></div>
          : <p className="mu">القسم ده لسه هيتبنى في مرحلة لاحقة (راجع PLAN.md).</p>}
      </main>
    </div>
  );
}
