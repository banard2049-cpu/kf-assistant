@echo off
setlocal
cd /d "%~dp0"
call "%~dp0check-windows.bat"
if errorlevel 1 (
  pause
  exit /b 1
)
set "PHP_EXE="
if exist "%~dp0runtime\php\php.exe" (
  set "PHP_EXE=%~dp0runtime\php\php.exe"
) else (
  for /f "delims=" %%p in ('where php 2^>nul') do (
    set "PHP_EXE=%%p"
    goto :php_found
  )
  for /f "usebackq delims=" %%p in (`powershell.exe -NoProfile -Command "$command = Get-Command php -ErrorAction SilentlyContinue; if ($command) { $command.Source }"`) do (
    set "PHP_EXE=%%p"
    goto :php_found
  )
)
:php_found
for %%p in ("%PHP_EXE%") do set "PHP_DIR=%%~dpp"
set "PHP_EXT=%PHP_DIR%ext"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  set LAN_IP=%%a
  goto :found
)
:found
set LAN_IP=%LAN_IP: =%
echo.
echo KF Unified Campaign Assistant
echo Local: http://127.0.0.1:8789
if defined LAN_IP echo LAN:   http://%LAN_IP%:8789
echo.
start "" "http://127.0.0.1:8789"
"%PHP_EXE%" -d "extension_dir=%PHP_EXT%" -d extension=pdo_sqlite -d extension=sqlite3 -d extension=mbstring -S 0.0.0.0:8789 -t public
pause
