-- 59: قراءة بس — بتعرض الدفعات المكررة اللي اتسجلت النهاردة (نفس العميل + نفس المبلغ + نفس الاتجاه).
-- مابتعدّل ولا بتمسح أي حاجة. شغّلها في SQL Editor وابعتلي النتيجة قبل أي تنضيف.
select p.contact_id, p.name, p.dir, p.amount, count(*) as عدد_المرات,
       min(p.created_at) as أول_مرة, max(p.created_at) as آخر_مرة,
       array_agg(p.id order by p.created_at) as ids
  from public.mk_payments p
 where p.created_at >= date_trunc('day', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'
 group by p.contact_id, p.name, p.dir, p.amount
having count(*) > 1
 order by max(p.created_at) desc;
