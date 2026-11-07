// منقول من إدارة الموقع (rebuild/site/src/app/admin) عشان الإدارة كلها تبقى جوه السيستم وتحفظ في نفس المكان اللي الموقع بيقرا منه.
// «تجيلنا إزاي»: written directions per starting point. The owner edits them from /admin (التوصيل والتواصل);
// until he saves his own, these defaults show.
export type Route = { from: string; text: string; note: string };

export const DEFAULT_ROUTES: Route[] = [
  {
    from: 'جاي من جامعة الدول',
    text: 'اطلع الكوبري اللي رايح أرض اللواء\nعلى الشمال شارع ناهيا وعلى اليمين أرض اللواء: انزل يمين\nكمّل على طول واسأل على شارع ١٠ اللي في وش الشهدا',
    note: 'قول «شارع عشرة اللي في أرض اللواء، في وش الشهدا»، عشان فيه شارع عشرة تاني في بولاق',
  },
  {
    from: 'جاي من الدائري',
    text: 'انزل نزلة المعتمدية أو نزلة الكهربا\nاسأل على «عبد الرحيم عمرو»، إحنا بعده\nاسأل على شارع ١٠ اللي في وش الشهدا',
    note: 'قول «شارع عشرة اللي في أرض اللواء»، مش اللي في بولاق',
  },
];

export const routesOf = (r: Route[] | undefined) => (r?.length ? r : DEFAULT_ROUTES).filter(x => x.from.trim() || x.text.trim());
