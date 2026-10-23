-- 68: تعليقات الصفحات في صندوق mk_social_msgs — عمود kind ('dm' رسالة | 'comment' تعليق). الجدول كان فاضي (0 صف). من غير delete/drop. اتطبق 2026-10-23.
alter table public.mk_social_msgs add column if not exists kind text not null default 'dm';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mk_social_msgs_kind_chk') then
    alter table public.mk_social_msgs add constraint mk_social_msgs_kind_chk check (kind in ('dm','comment'));
  end if;
end $$;
