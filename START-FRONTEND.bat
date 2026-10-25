@echo off
title SMART MONITORING - React Frontend
SET NODE=C:\Users\ranie\Downloads\nodejs_portable\node-v20.19.4-win-x64
SET NPM=%NODE%\npm.cmd
SET REACT=C:\Users\ranie\Downloads\SMART-MONITORING-main\SMART-MONITORING-main\myreactapp-React

echo ============================================
echo  SMART MONITORING - React Frontend
echo  Running on http://localhost:3000
echo ============================================
echo.

cd /d "%REACT%"
SET PATH=%NODE%;%PATH%
call "%NPM%" run dev
pause
