# YOLOv8 + ArcFace Face Recognition Service

This project now includes an optional service contract for high-scale face recognition.

## Why this service

Browser-side recognition works for small groups, but 60+ students is more reliable with server-side inference.

## Files

- `scripts/face_recognition_service.py`
- `scripts/face-service-requirements.txt`
- `app/api/recognition/route.ts`

## Run service

```bash
pip install -r scripts/face-service-requirements.txt
uvicorn scripts.face_recognition_service:app --host 0.0.0.0 --port 8001
```

## Configure Next.js

Add this in `.env.local`:

```bash
FACE_RECOGNITION_SERVICE_URL=http://localhost:8001
```

## API contract

`POST /api/recognition`

Request JSON:

- `image_base64`: camera frame
- `students`: list of registered student embeddings

Response JSON:

- `matches`: recognized students list
- `message`: optional status

## Note

`face_recognition_service.py` currently defines the interface and health endpoint.
Replace `/recognize` body with actual YOLOv8 face detection + ArcFace embedding code for production inference.
