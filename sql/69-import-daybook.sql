-- 69: استيراد يومية Excel بيظهر كمان في «📒 يومية المحل» (صفوف مصفّاة بتاريخ اليومية، علامة «يومية استيراد Excel»)
-- من غير ما يلمس المخزون تاني (الفاتورة هي اللي بتخصم) ومن غير حذف أي حاجة. القديم ما اتغيرش.
-- الدالة القديمة (64) محفوظة في sql/64-*.sql لو احتجت ترجع لها.
create or replace function public.mk_import_invoices(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it jsonb; i int := 0; r jsonb; out jsonb := '[]'::jsonb; ln jsonb; d date; who text;
begin
  if public.mk_role() is null then raise exception 'not_member'; end if;
  if jsonb_typeof(p->'invoices') <> 'array' or jsonb_array_length(p->'invoices') < 1 then raise exception 'no_invoices'; end if;
  for it in select * from jsonb_array_elements(p->'invoices') loop
    i := i + 1;
    begin
      r := public.mk_save_invoice(it);
      d := coalesce(nullif(it->>'date','')::date, public.mk_today());
      who := case when coalesce((it->>'no_contact')::boolean, false) then '' else btrim(coalesce(it->>'person','')) end;
      for ln in select * from jsonb_array_elements(coalesce(it->'items','[]'::jsonb)) loop
        insert into public.mk_daybook(day, product_id, name, qty, price, owed, person, pay, note, created_by, committed_at, posted_at, invoice_id, invoice_no, kind)
        values (d, nullif(ln->>'product_id','')::uuid, coalesce(nullif(ln->>'name',''),'صنف'), (ln->>'qty')::numeric, coalesce((ln->>'price')::numeric,0), 0, who,
                case when ln->>'pay' = 'credit' then 'credit' else 'cash' end, 'يومية استيراد Excel', 'استيراد Excel', now(), now(), (r->>'id')::uuid, r->>'no', 'item');
      end loop;
    exception when others then
      raise exception 'فاتورة % (%): %', i, coalesce(nullif(it->>'person',''), 'يومية'), sqlerrm;
    end;
    out := out || jsonb_build_array(r);
  end loop;
  return out;
end $$;
revoke all on function public.mk_import_invoices(jsonb) from public, anon;
grant execute on function public.mk_import_invoices(jsonb) to authenticated;
