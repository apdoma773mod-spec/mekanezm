# تقدم إدراج الصور الذكي (جلسة studio-work)
- Vercel: الفرع الإنتاجي في git = main. الـ Production بتاع mekanezm-studio بيتنشر بـ `vercel deploy --prod` من CLI (source=cli). أي push لفرع تاني = Preview.
- اتكتب: supabase/functions/video-images/index.ts (لسه مش منشورة على Supabase، ولسه ما اتختبرتش). ارفع MAX_SEG لـ 800.
- اتكتب (مش متركّب في engine.ts): studio-next/lib/montage/WIP-smart-images-block.js.txt — يتحط قبل تعليق «لمسات ذكية» + import { loadFiles } from '../templates/media' في أول engine.ts.
- باقي التركيب في engine.ts: كارت HTML (sm_if/sm_ii/sm_ist/sm_imb + كارت sm_il النتايج)، سطر الرسم بعد drawBroll: `if(!BR){const IB=imActive(t);if(IB)drawImg(IB,t,W,H)}`، TILES (pre للرفع + res للأماكن)، فلتر CNT سطر ~1099 يشمل IML، سطور التقرير، state + _test.imApply، ثم الاختبار بـ Chrome headless وتشغيل tests/pro*.test.cjs.
- بعدها: أفكار التطوير لعبده. ممنوع نشر قبل ما يقول «انشر».
