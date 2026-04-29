@echo off
echo ========================================================
echo   ATTENDANCE TRACKING SYSTEM - SMART STARTUP
echo ========================================================
echo.

:: 1. Start AI Face Recognition Service in a new window
echo [*] Starting AI Service (Python/FastAPI)...
start "AI Face Recognition Service" cmd /k "python -m uvicorn scripts.face_recognition_service:app --host 127.0.0.1 --port 8000"

:: 2. Wait for a few seconds for AI to warm up
timeout /t 5 /nobreak > nul

:: 3. Start Next.js Frontend
echo [*] Starting Next.js Frontend...
start "Attendance System Frontend" cmd /k "npm run dev"

echo.
echo ========================================================
echo   SYSTEM STARTUP TRIGGERED
echo   - AI Backend: http://127.0.0.1:8000
echo   - Web Frontend: http://localhost:3000
echo.
echo   Note: Keep the other two windows open!
echo ========================================================
pause
