@echo off
python -m uvicorn scripts.face_recognition_service:app --host 127.0.0.1 --port 8000
