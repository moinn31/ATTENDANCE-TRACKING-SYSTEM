@echo off
echo === Starting YOLOv8 + ArcFace AI Service ===
python -m uvicorn scripts.face_recognition_service:app --host 127.0.0.1 --port 8000
pause
