# النسخ الاحتياطي اليومي على Google Drive

1. نصّب **Google Drive for Desktop** وسجّل دخول. هيظهر درايف `G:\My Drive`.
2. اعمل فولدر `G:\My Drive\mekanezm-backups`.
3. جرّب مرة يدوي:
   `powershell -ExecutionPolicy Bypass -File rebuild\ops\backup.ps1 -Dest "G:\My Drive\mekanezm-backups"`
4. جدولها كل يوم 3 الفجر:
   `schtasks /Create /SC DAILY /ST 03:00 /TN MekanezmBackup /TR "powershell -ExecutionPolicy Bypass -File C:\path\to\rebuild\ops\backup.ps1 -Dest 'G:\My Drive\mekanezm-backups'"`
5. **اختبار الاسترجاع** (مهم): `createdb mk_restore_test` ثم
   `pg_restore --no-owner -d mk_restore_test <الملف>.dump` وتأكد إن الجداول والعدد صح.
