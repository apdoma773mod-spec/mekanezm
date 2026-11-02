# نسخة احتياطية يومية: pg_dump -> فولدر Google Drive (Drive for Desktop بيرفعه لوحده).
# التشغيل:  powershell -ExecutionPolicy Bypass -File backup.ps1 -Dest "G:\My Drive\mekanezm-backups"
# لازم متغير DATABASE_URL يكون متظبط (نفس اللي الـbackend بيستخدمه) و pg_dump في PATH.
param(
  [Parameter(Mandatory=$true)][string]$Dest,
  [string]$DbUrl = $env:DATABASE_URL,
  [int]$Keep = 30
)
$ErrorActionPreference = 'Stop'
if (-not $DbUrl) { throw 'DATABASE_URL مش متظبط' }
if (-not (Test-Path $Dest)) { New-Item -ItemType Directory -Path $Dest | Out-Null }

$file = Join-Path $Dest ("mekanezm-{0:yyyy-MM-dd_HHmm}.dump" -f (Get-Date))
# prisma بيضيف ?schema=public وpg_dump مش بيفهمها
$url = $DbUrl -replace '\?schema=[^&]*',''
& pg_dump --format=custom --no-owner --file=$file $url
if ($LASTEXITCODE -ne 0 -or -not (Test-Path $file) -or (Get-Item $file).Length -lt 1024) {
  if (Test-Path $file) { Remove-Item $file }
  throw 'pg_dump فشل أو الملف فاضي'
}
# سيب آخر $Keep نسخة بس
Get-ChildItem $Dest -Filter 'mekanezm-*.dump' | Sort-Object LastWriteTime -Descending |
  Select-Object -Skip $Keep | Remove-Item -Force
"تمام: $file ({0:N1} MB)" -f ((Get-Item $file).Length / 1MB)
