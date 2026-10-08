-- =====================================================================
-- Mika Omnix — الجزء 2: الصلاحيات + العزل بين المحلات (RLS)
-- =====================================================================
-- دور الدوال: عليه RLS زي المستخدم بالظبط (مش زي postgres)
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'mk_fn') then create role mk_fn nologin; end if;
end $$;
grant mk_fn to postgres;
grant authenticated to mk_fn;
grant usage, create on schema public to mk_fn;

do $$
declare t text;
begin
  foreach t in array array['mk_orgs','mk_members','mk_settings','mk_products','mk_product_costs','mk_contacts','mk_invoices','mk_invoice_items',
    'mk_item_costs','mk_payments','mk_returns','mk_expenses','mk_quotes','mk_voided','mk_log','mk_backups','mk_stock_moves','mk_counts',
    'mk_closings','mk_shipments','mk_daybook','mk_scans','wa_config','wa_orders'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to mk_fn', t);
    begin execute format('grant all on public.%I to service_role', t); exception when others then null; end;
  end loop;
end $$;
grant usage, select on sequence public.mk_log_id_seq, public.mk_ship_seq to authenticated, mk_fn;
-- مايقدرش أي حد يعدّل المحل أو أسرار الواتساب مباشرة
revoke insert, update, delete on public.mk_orgs from authenticated;
revoke insert, update, delete on public.wa_config from authenticated;
revoke insert, delete on public.wa_orders from authenticated;

-- امسح سياساتنا القديمة (الملف آمن يتشغل أكتر من مرة)
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public'
            and (policyname like 'mk\_%' escape '\' or policyname like 'z\_%' escape '\' or policyname like 'wa\_%' escape '\') loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- ===== العزل (restrictive): كل صف لازم يكون من محل المستخدم، والكتابة لازم الاشتراك يكون شغال =====
do $$
declare t text;
begin
  foreach t in array array['mk_settings','mk_products','mk_product_costs','mk_contacts','mk_invoices','mk_invoice_items',
    'mk_item_costs','mk_payments','mk_returns','mk_expenses','mk_quotes','mk_voided','mk_log','mk_backups','mk_stock_moves','mk_counts',
    'mk_closings','mk_shipments','mk_daybook','mk_scans','wa_config','wa_orders','mk_members'] loop
    execute format('create policy z_org on public.%I as restrictive for all to public using (org = (select public.mk_org())) with check (org = (select public.mk_org()) and (select public.mk_org_active()))', t);
    -- الدوال (mk_fn): كل حاجة جوه المحل بتاعها
    execute format('create policy mk_fn_all on public.%I for all to mk_fn using (true) with check (true)', t);
  end loop;
end $$;
create policy z_org on public.mk_orgs as restrictive for all to public using (id = (select public.mk_org()));
create policy mk_orgs_sel on public.mk_orgs for select to authenticated using (true);

-- ===== نفس صلاحيات سيستم ميكانيزم (مدير / موظف) =====
create policy mk_members_sel on public.mk_members for select to authenticated using (user_id = auth.uid() or public.mk_is_admin());
create policy mk_members_adm on public.mk_members for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());

create policy mk_settings_sel on public.mk_settings for select to authenticated using (public.mk_is_member());
create policy mk_settings_adm on public.mk_settings for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_products_sel on public.mk_products for select to authenticated using (public.mk_is_member());
create policy mk_products_adm on public.mk_products for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_contacts_sel on public.mk_contacts for select to authenticated using (public.mk_is_member());
create policy mk_contacts_adm on public.mk_contacts for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());

create policy mk_pcost_adm on public.mk_product_costs for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_icost_adm on public.mk_item_costs for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_pay_adm on public.mk_payments for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_ret_adm on public.mk_returns for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_exp_adm on public.mk_expenses for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_void_adm on public.mk_voided for all to authenticated using (public.mk_is_admin()) with check (public.mk_is_admin());
create policy mk_log_adm on public.mk_log for select to authenticated using (public.mk_is_admin());
create policy mk_bak_adm on public.mk_backups for select to authenticated using (public.mk_is_admin());

create policy mk_inv_sel on public.mk_invoices for select to authenticated
  using (public.mk_is_admin() or (public.mk_is_member() and (kind = 'sale' or created_by = auth.uid())));
create policy mk_items_sel on public.mk_invoice_items for select to authenticated
  using (exists (select 1 from public.mk_invoices i where i.id = invoice_id));

create policy mk_quotes_sel on public.mk_quotes for select to authenticated using (public.mk_is_member());
create policy mk_quotes_ins on public.mk_quotes for insert to authenticated with check (public.mk_is_member());
create policy mk_quotes_upd on public.mk_quotes for update to authenticated using (public.mk_is_member()) with check (public.mk_is_member());
create policy mk_quotes_del on public.mk_quotes for delete to authenticated using (public.mk_is_admin());

create policy mk_moves_adm on public.mk_stock_moves for select to authenticated using (public.mk_is_admin());
create policy mk_counts_adm on public.mk_counts for select to authenticated using (public.mk_is_admin());
create policy mk_closings_sel on public.mk_closings for select to authenticated using (public.mk_is_admin() or by_name = public.mk_me_name());

create policy mk_ship_sel on public.mk_shipments for select to authenticated using (public.mk_is_member());
create policy mk_ship_ins on public.mk_shipments for insert to authenticated with check (public.mk_is_member());
create policy mk_ship_upd on public.mk_shipments for update to authenticated using (public.mk_is_member()) with check (public.mk_is_member());
create policy mk_ship_del on public.mk_shipments for delete to authenticated using (public.mk_is_admin());

create policy mk_daybook_sel on public.mk_daybook for select to authenticated using (public.mk_is_member());
create policy mk_scans_all on public.mk_scans for all to authenticated using (public.mk_is_member()) with check (public.mk_is_member());

create policy wa_cfg_sel on public.wa_config for select to authenticated using (public.mk_is_admin());
create policy wa_sel on public.wa_orders for select to authenticated using (public.mk_role() is not null);
create policy wa_upd on public.wa_orders for update to authenticated using (public.mk_role() is not null) with check (public.mk_role() is not null);

-- تحديث لحظي بين الأجهزة
do $$
declare t text;
begin
  foreach t in array array['mk_products','mk_contacts','mk_invoices','mk_invoice_items','mk_payments','mk_returns','mk_expenses','mk_quotes',
    'mk_settings','mk_stock_moves','mk_counts','mk_closings','mk_shipments','mk_daybook','mk_scans','wa_orders'] loop
    begin execute format('alter publication supabase_realtime add table public.%I', t); exception when others then null; end;
  end loop;
end $$;

select 'OK - part B (security)' as result;
