@echo off
rem ---------------------------------------------------------------
rem  Start backend (Spring Boot) in the backend directory.
rem  Prerequisite: mvn clean package -DskipTests
rem ---------------------------------------------------------------
setlocal
cd /d "%~dp0..\backend"

if not exist "target\gnss-solver-1.0.0.jar" (
  echo [ERROR] target\gnss-solver-1.0.0.jar not found.
  echo         Run:  mvn clean package -DskipTests
  pause
  exit /b 1
)

if not exist "target\position.exe" (
  echo [INFO] copying solver: tools\position.exe -^> backend\target\
  copy /y "..\tools\position.exe" "target\position.exe" >nul
)

echo ==========================================
echo  Backend: http://localhost:8080
echo  Health : http://localhost:8080/api/solver/health
echo ==========================================
java -jar "target\gnss-solver-1.0.0.jar"
pause
