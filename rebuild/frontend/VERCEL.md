# نشر لوحة الإدارة (frontend) على Vercel — للمعاينة

مشروع Vercel **جديد** من نفس الريبو:
- Root Directory: `rebuild/frontend`  (وسيب "Include source files outside of the Root Directory" شغّال)
- Install Command: `cd .. && npm install`
- Build Command: `cd .. && npm run build -w shared && npm run build -w frontend`
- Environment Variables (Preview): `BACKEND_URL` = لينك ngrok (من غير `/` في الآخر)
- Production Branch: سيبه، واستخدم Preview لفرع `admin-on-vercel`.

الباك إند لازم يفضل شغال على الكمبيوتر + ngrok.
