@echo off
REM ================================================================
REM  Poseidon Dashboard — push all dashboard files to GitHub
REM  Repo: https://github.com/Robert-Upchurch/Poseidon-Dashboard-V5
REM
REM  Ships: landing page (index.html), V5 (frozen), V6 (in progress)
REM  Double-click this file, or run from a command prompt.
REM ================================================================

setlocal
cd /d "%~dp0"

echo.
echo === Clearing stale git lock files (if any) ===
if exist ".git\index.lock" del /F /Q ".git\index.lock"
if exist ".git\HEAD.lock"  del /F /Q ".git\HEAD.lock"

echo.
echo === Current status ===
git status

echo.
echo === Staging dashboard files ===
git add index.html poseidon-dashboard-v5.html poseidon-dashboard-v6.html push-to-github.bat
if errorlevel 1 goto :fail

echo.
echo === Committing ===
git -c user.email=ceo@cti-usa.com -c user.name="Robert Upchurch" commit -m "Poseidon V6 scaffold: clone V5, add version selector landing page"
if errorlevel 1 (
    echo.
    echo No changes to commit ^(already committed^). Continuing to push...
)

echo.
echo === Pushing to origin/main ===
git push origin main
if errorlevel 1 goto :fail

echo.
echo ================================================================
echo  SUCCESS
echo  Repo:       https://github.com/Robert-Upchurch/Poseidon-Dashboard-V5
echo  Landing:    https://robert-upchurch.github.io/Poseidon-Dashboard-V5/
echo  V5 direct:  https://robert-upchurch.github.io/Poseidon-Dashboard-V5/poseidon-dashboard-v5.html
echo  V6 direct:  https://robert-upchurch.github.io/Poseidon-Dashboard-V5/poseidon-dashboard-v6.html
echo  (Pages rebuild takes ~60 seconds.)
echo ================================================================
pause
exit /b 0

:fail
echo.
echo ================================================================
echo  FAILED. See messages above.
echo  Most common cause: Git prompted for credentials and you canceled,
echo  or your Personal Access Token expired. Run:
echo      git push origin main
echo  in a terminal and authenticate, then re-run this script.
echo ================================================================
pause
exit /b 1
