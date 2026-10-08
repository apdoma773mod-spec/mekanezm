// Mika Omnix — Edge Function "mk-users": مدير المحل بيضيف/يعدّل موظفين محله هو بس
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller = createClient(url, anon, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } }, auth: { persistSession: false } });
    const { data: isAdmin, error: e0 } = await caller.rpc('mk_is_admin');
    if (e0 || isAdmin !== true) return json({ error: 'admin_only' }, 403);
    const { data: org } = await caller.rpc('mk_org');
    const { data: active } = await caller.rpc('mk_org_active');
    if (!org) return json({ error: 'not_member' }, 403);
    const { data: me } = await caller.auth.getUser();
    const { data: myName } = await caller.rpc('mk_me_name');
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const log = (action: string, ref: string) => admin.from('mk_log').insert({ org, user_id: me?.user?.id, user_name: myName ?? '', action, ref });
    // الموظف لازم يكون من نفس المحل
    const sameOrg = async (uid: string) => {
      const { data } = await admin.from('mk_members').select('org,role,name').eq('user_id', uid).maybeSingle();
      return data && data.org === org ? data : null;
    };

    const b = await req.json();
    const pinOk = (p: unknown) => typeof p === 'string' && /^\d{6,12}$/.test(p);

    if (b.action === 'create') {
      if (active !== true) return json({ error: 'الاشتراك خلص — جدّد الاشتراك الأول' }, 403);
      const name = String(b.name ?? '').trim();
      if (name.length < 2 || name.length > 60) return json({ error: 'bad_name' }, 400);
      if (!['admin', 'emp'].includes(b.role)) return json({ error: 'bad_role' }, 400);
      if (!pinOk(b.pin)) return json({ error: 'bad_pin' }, 400);
      const { count: n } = await admin.from('mk_members').select('user_id', { count: 'exact', head: true }).eq('org', org);
      if ((n ?? 0) >= 30) return json({ error: 'وصلت للحد الأقصى للمستخدمين' }, 400);
      const { data: dup } = await admin.from('mk_members').select('user_id').eq('org', org).eq('name', name).maybeSingle();
      if (dup) return json({ error: 'name_taken' }, 400);
      const email = `s${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}@staff.mikaomnix.app`;
      const { data, error } = await admin.auth.admin.createUser({ email, password: b.pin, email_confirm: true, user_metadata: { name, staff: 'true' } });
      if (error || !data.user) return json({ error: error?.message ?? 'create_failed' }, 400);
      const { error: e2 } = await admin.from('mk_members').insert({ user_id: data.user.id, org, name, role: b.role, email });
      if (e2) { await admin.auth.admin.deleteUser(data.user.id); return json({ error: e2.message }, 400); }
      await log('user.create', name);
      return json({ user_id: data.user.id, email });
    }

    if (b.action === 'set_pin') {
      if (!pinOk(b.pin)) return json({ error: 'bad_pin' }, 400);
      const m = await sameOrg(b.user_id);
      if (!m) return json({ error: 'not_found' }, 404);
      const { error } = await admin.auth.admin.updateUserById(b.user_id, { password: b.pin });
      if (error) return json({ error: error.message }, 400);
      await log('user.pin', m.name);
      return json({ ok: true });
    }

    if (b.action === 'delete') {
      if (b.user_id === me?.user?.id) return json({ error: 'cannot_delete_self' }, 400);
      const m = await sameOrg(b.user_id);
      if (!m) return json({ error: 'not_found' }, 404);
      // صاحب المحل مايتمسحش
      const { data: o } = await admin.from('mk_orgs').select('owner').eq('id', org).maybeSingle();
      if (o?.owner === b.user_id) return json({ error: 'last_admin' }, 400);
      if (m.role === 'admin') {
        const { count } = await admin.from('mk_members').select('user_id', { count: 'exact', head: true }).eq('org', org).eq('role', 'admin').eq('active', true);
        if ((count ?? 0) < 2) return json({ error: 'last_admin' }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(b.user_id);
      if (error) return json({ error: error.message }, 400);
      await log('user.delete', m.name);
      return json({ ok: true });
    }

    return json({ error: 'bad_action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
