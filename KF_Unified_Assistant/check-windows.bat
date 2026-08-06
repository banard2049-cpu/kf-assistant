@echo off
setlocal
cd /d "%~dp0"
set "PHP_EXE="
if exist "%~dp0runtime\php\php.exe" (
  set "PHP_EXE=%~dp0runtime\php\php.exe"
) else (
  for /f "delims=" %%p in ('where php 2^>nul') do (
    set "PHP_EXE=%%p"
    goto :php_found
  )
)
if not defined PHP_EXE (
  echo PHP 8.2 or newer was not found.
  echo Use the portable package or install PHP before starting.
  exit /b 1
)
:php_found
for %%p in ("%PHP_EXE%") do set "PHP_DIR=%%~dpp"
"%PHP_EXE%" -r "exit(version_compare(PHP_VERSION,'8.2.0','>=')?0:1);"
if errorlevel 1 (
  echo PHP 8.2 or newer is required.
  exit /b 1
)
"%PHP_EXE%" -d "extension_dir=%PHP_DIR%ext" -d extension=pdo_sqlite -d extension=sqlite3 -d extension=mbstring -r "exit(extension_loaded('pdo_sqlite')&&defined('PASSWORD_ARGON2ID')?0:1);"
if errorlevel 1 (
  echo PHP SQLite or Argon2id could not be loaded.
  exit /b 1
)
if not exist ".env" copy ".env.example" ".env" >nul
if not exist "data" mkdir "data"
if not exist "backups" mkdir "backups"
if not exist "logs" mkdir "logs"
echo PHP environment check passed: %PHP_EXE%
