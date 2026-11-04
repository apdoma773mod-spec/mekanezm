# Trial hosting of the site on this PC (port 3300) + a temporary public link. Needs the system backend on :4000.
$env:SITE_FROM_BACKEND='1'; $env:BACKEND_URL='http://127.0.0.1:4000'; $env:NEXT_PUBLIC_NEW_BACKEND='1'
Start-Process -WindowStyle Hidden npx -ArgumentList 'next','start','-p','3300'
Start-Sleep 8
Start-Process -WindowStyle Hidden 'C:\Program Files (x86)\cloudflared\cloudflared.exe' -ArgumentList 'tunnel','--url','http://127.0.0.1:3300','--no-autoupdate' -RedirectStandardError "$env:TEMP\cf3300.log"
