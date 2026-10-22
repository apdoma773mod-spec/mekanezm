-- 64: استيراد يومية Excel في transaction واحدة (#17): كل الفواتير تتسجل أو ولا واحدة.
-- بيستخدم نفس mk_save_invoice لكل فاتورة، وأي خطأ بيلغي الكل ويرجّع رقم الفاتورة واسمها في الرسالة.
-- (ويتأكد إن mk_lock موجودة — كانت اتمسحت من القاعدة بعد SQL 63.)
create or replace function public.mk_lock() returns void
language sql security definer set search_path = public as
$$ select pg_advisory_xact_lock(7002) $$;
revoke all on function public.mk_lock() from public, anon;
grant execute on function public.mk_lock() to authenticated;

create or replace function public.mk_import_invoices(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; i int := 0; r jsonb; out jsonb := '[]'::jsonb;
begin
  if public.mk_role() is null then raise exception 'not_member'; end if;
  if jsonb_typeof(p->'invoices') <> 'array' or jsonb_array_length(p->'invoices') < 1 then raise exception 'no_invoices'; end if;
  for it in select * from jsonb_array_elements(p->'invoices') loop
    i := i + 1;
    begin
      r := public.mk_save_invoice(it);
    exception when others then
      raise exception 'فاتورة % (%): %', i, coalesce(nullif(it->>'person',''), 'يومية'), sqlerrm;
    end;
    out := out || jsonb_build_array(r);
  end loop;
  return out;
end $$;
revoke all on function public.mk_import_invoices(jsonb) from public, anon;
grant execute on function public.mk_import_invoices(jsonb) to authenticated;
