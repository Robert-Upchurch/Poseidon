@echo off
title Poseidon Push
cd /d "C:\Projects\Poseidon"
if errorlevel 1 ( echo [ERROR] cd failed & pause & exit /b 1 )
echo === Repo: %CD% ===
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
if exist ".git\index.lock" del /f /q ".git\index.lock"
git status
git add -A
git commit -m "%~1"
git push origin main
if errorlevel 1 ( echo [ERROR] Push failed & pause & exit /b 1 )
echo === DONE — GitHub Pages rebuilds in ~60s ===
pause
