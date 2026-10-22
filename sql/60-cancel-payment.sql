-- 60: إلغاء دفعة (حذف كامل كأنها ما حصلتش) — #11
-- رصيد العميل/المورد بيرجع زي ما كان، الدفعة بتتمسح من mk_payments (فبتختفي من الخزنة والتقارير)،
-- وسطر تسجيل الدفعة الأصلي في mk_log بيتشال. بيفضل سطر واحد مخفي: payment.cancel (مين/إمتى/كام).
-- للمدير بس. مابيغيّرش أي جدول، بيضيف دالة واحدة.
create or replace function public.mk_cancel_payment(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v public.mk_payments; v_log bigint;
begin
  if not public.mk_is_admin() then raise exception 'admin_only'; end if;
  perform public.mk_lock();
  select * into v from public.mk_payments where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if v.contact_id is not null then
    update public.mk_contacts set balance = round(balance + v.amount, 2) where id = v.contact_id;
  end if;
  select id into v_log from public.mk_log
   where action = 'payment' and ref = v.name and (details->>'amount')::numeric = v.amount
     and at between v.created_at - interval '1 minute' and v.created_at + interval '1 minute'
   order by abs(extract(epoch from (at - v.created_at))) limit 1;
  if v_log is not null then delete from public.mk_log where id = v_log; end if;
  delete from public.mk_payments where id = p_id;
  perform public.mk_log_add('payment.cancel', v.name,
    jsonb_build_object('amount', v.amount, 'dir', v.dir, 'payment_id', v.id, 'paid_at', v.created_at));
  return jsonb_build_object('ok', true, 'amount', v.amount, 'contact_id', v.contact_id);
end $$;
revoke all on function public.mk_cancel_payment(uuid) from public, anon;
grant execute on function public.mk_cancel_payment(uuid) to authenticated;
