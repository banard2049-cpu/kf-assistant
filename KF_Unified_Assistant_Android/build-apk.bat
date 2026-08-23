@echo off
setlocal
cd /d "%~dp0"

echo Building standalone KF Unified Assistant APK...
echo The APK includes all web assets and uses Android SQLite. PHP is not required.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-android.ps1" -IncrementPatch

set "EXIT_CODE=%ERRORLEVEL%"
echo.
if "%EXIT_CODE%"=="0" (
  echo Build completed. APK files are in:
  echo %~dp0dist
) else (
  echo Build failed with exit code %EXIT_CODE%.
)
echo.
pause
exit /b %EXIT_CODE%
