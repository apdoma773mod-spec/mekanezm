-- العامل في الخلفية (vr-worker / video-ai) بيقرا بمفتاح service_role — الجداول اتعملت من غير صلاحياته فكان كل طلب بيرجع forbidden
grant select, insert, update, delete on public.mk_video_jobs to service_role;
grant select on public.mk_vr_secret to service_role;
