-- 70: «💯 صفّر الحساب» — دفعة واحدة بكل رصيد العميل/المورد (موجب: تحصيل/سداد كامل — سالب: رد الرصيد له أو تسوية).
-- الدفعة بتتسجل بقيمة الرصيد نفسه (ممكن سالبة)، فـ mk_cancel_payment بيرجّع الرصيد صح (balance + amount).
-- p_cash=false: تسوية من غير فلوس (الملاحظة بتبدأ بـ «رصيد» فمابتدخلش حساب الدرج). من غير delete/drop.
create or replace function public.mk_zero_account(p_contact uuid, p_cash boolean default true, p_co text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.mk_contacts; v uuid; b numeric; nt text;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  if p_co is not null and p_co not in ('mk','hy') then raise exception 'شركة غير معروفة'; end if;
  perform public.mk_lock();
  select * into c from public.mk_contacts where id = p_contact for update;
  if not found then raise exception 'not_found'; end if;
  b := round(c.balance, 2);
  if abs(b) < 0.005 then raise exception 'already_zero'; end if;
  nt := case when b > 0 then 'تصفير الحساب'
             when p_cash then 'رد رصيد ' || case when c.type = 'عميل' then 'للعميل' else 'من المورد' end || ' (تصفير الحساب)'
             else 'رصيد: تسوية تصفير الحساب (من غير فلوس)' end;
  update public.mk_contacts set balance = 0 where id = p_contact;
  insert into public.mk_payments(contact_id, name, dir, amount, note, date_txt, created_by_name)
  values (p_contact, c.name, case when c.type = 'عميل' then 'in' else 'out' end, b, nt, public.mk_ar_date(current_date), public.mk_me_name())
  returning id into v;
  if p_co is not null then update public.mk_payments set co = p_co where id = v; end if;
  perform public.mk_log_add('payment', c.name, jsonb_build_object('amount', b));
  return v;
end $$;
revoke all on function public.mk_zero_account(uuid, boolean, text) from public, anon;
grant execute on function public.mk_zero_account(uuid, boolean, text) to authenticated;
