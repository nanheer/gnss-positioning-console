@echo off
rem ---------------------------------------------------------------
rem  Start frontend (Vite dev server) in the frontend directory.
rem  Prerequisite: Node.js 20.19+ or 22.12+
rem ---------------------------------------------------------------
setlocal
cd /d "%~dp0..\frontend"

if not exist "node_modules" (
  echo [INFO] installing dependencies ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

echo ==========================================
echo  Frontend: http://localhost:5173
echo  API proxy: /api/solver -^> http://localhost:8080
echo ==========================================
call npm run dev
pause
