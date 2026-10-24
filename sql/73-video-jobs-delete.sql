-- 73: مسح فيديو من «فيديوهاتي» (صاحبه بس، ومش وهو شغال)
grant delete on public.mk_video_jobs to authenticated;
drop policy if exists vj_del on public.mk_video_jobs;
create policy vj_del on public.mk_video_jobs for delete to authenticated using (user_id = auth.uid() and status <> 'working');
