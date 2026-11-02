# نشر لوحة الإدارة (frontend) على Vercel — للمعاينة

مشروع Vercel **جديد** من نفس الريبو (اسمه `mekanezm-admin`):
- Root Directory: `rebuild/frontend`  (وسيب "Include files outside the root directory" شغّال)
- Framework Preset: Next.js
- Install Command (Override): `cd .. && npm install`
- Build Command (Override): `cd .. && npm run build -w shared && npm run build -w frontend`
- Output Directory: **من غير Override** (الافتراضي)
- Environment Variables: `BACKEND_URL` = لينك ngrok (من غير `/` في الآخر)
- Production Branch: `admin-on-vercel` (Settings → Environments → Production)

الباك إند لازم يفضل شغال على الكمبيوتر + ngrok.
