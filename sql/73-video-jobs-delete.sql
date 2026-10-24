-- 73: مسح فيديو من «فيديوهاتي» (صاحبه بس، ومش وهو شغال)
grant delete on public.mk_video_jobs to authenticated;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='mk_video_jobs' and policyname='vj_del') then
    create policy vj_del on public.mk_video_jobs for delete to authenticated using (user_id = auth.uid() and status <> 'working');
  end if;
end $$;
