-- ميكانيزم — ⏱️ قراءة فواتير المشتريات في الخلفية: جدولة كل دقيقة لدالة scan-worker
-- قبل التشغيل: 1) انشر الدالة scan-worker في Supabase (Verify JWT = OFF)
--              2) ضيف Secret اسمه WORKER_SECRET بقيمة سر طويل من عندك (16 حرف على الأقل)
--              3) استبدل REPLACE_WITH_WORKER_SECRET تحت بنفس القيمة، وبعدين شغّل الملف في SQL Editor
-- لو عايز توقفها: select cron.unschedule('mk-scan-worker');

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('mk-scan-worker') where exists (select 1 from cron.job where jobname = 'mk-scan-worker');
select cron.schedule(
  'mk-scan-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://tkzfjeizvanfptnqvrmr.supabase.co/functions/v1/scan-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', 'REPLACE_WITH_WORKER_SECRET'),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
-- للتأكد: select jobname, schedule, active from cron.job;
-- آخر نتايج: select status_code, content, created from net._http_response order by created desc limit 5;
