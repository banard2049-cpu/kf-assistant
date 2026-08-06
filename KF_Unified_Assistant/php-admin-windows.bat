@echo off
setlocal
cd /d "%~dp0"
for /f "delims=" %%p in ('where php') do (
  set "PHP_EXE=%%p"
  goto :php_found
)
echo PHP was not found.
exit /b 1
:php_found
for %%p in ("%PHP_EXE%") do set "PHP_DIR=%%~dpp"
"%PHP_EXE%" -d "extension_dir=%PHP_DIR%ext" -d extension=pdo_sqlite -d extension=sqlite3 -d extension=mbstring tools\admin.php %*
