Write-Host "Packaging application..." -ForegroundColor Cyan
ares-package .

Write-Host "Installing on device lg-tv..." -ForegroundColor Cyan
ares-install -d lg-tv com.mary.catcast_1.0.0_all.ipk

Write-Host "Launching application..." -ForegroundColor Cyan
ares-launch -d lg-tv com.mary.catcast

Write-Host "`nApplication deployed and launched!" -ForegroundColor Green
Write-Host "`nIf you want to debug, run manually:" -ForegroundColor Yellow
Write-Host "ares-inspect com.mary.catcast -d lg-tv" -ForegroundColor White