# YOLO + ArcFace Face Recognition Service

This project includes a Python service at `scripts/face_recognition_service.py` that performs:

1. Face detection with YOLO face model.
2. Face embedding extraction with ArcFace (`insightface`).
3. Matching against enrolled student embeddings using cosine similarity.

## Recommended Model

For better accuracy (with moderate speed), use:

- `YOLO_FACE_MODEL=yolov8m-face.pt`
- `ARCFACE_MODEL=buffalo_l`

If you need faster inference on CPU, use `yolov8n-face.pt`.
If you need maximum accuracy and have a strong GPU, try `yolov8l-face.pt`.

## Important Note About "Indian Faces"

There is no single model that is reliably "best" for one ethnicity only.
For robust results across Indian classrooms and lighting conditions, accuracy depends on:

- Diverse enrollment captures per student (angles, lighting, glasses/no glasses).
- Good camera framing and illumination.
- Proper similarity threshold tuning for your deployment.

## Environment Variables

Set these in `.env.local` (Next.js) and in the shell where Python service runs:

- `FACE_RECOGNITION_SERVICE_URL=http://127.0.0.1:8000`
- `YOLO_FACE_MODEL=yolov8m-face.pt`
- `ARCFACE_MODEL=buffalo_l`
- `FACE_SIMILARITY_THRESHOLD=0.40`
- `YOLO_CONF_THRESHOLD=0.35`
- `YOLO_IMG_SIZE=960`
- `USE_CUDA=false`

## Start Service

```bash
cd scripts
pip install -r face-service-requirements.txt
uvicorn face_recognition_service:app --host 0.0.0.0 --port 8000 --reload
```

## Health Check

```bash
curl http://127.0.0.1:8000/health
```

## API Contract

- `POST /recognize`
- Request:
  - `image_base64`: image payload
  - `students`: list of enrolled students with `embedding`
- Response:
  - `matches`: best matched students with similarity, confidence, and bounding box
  - `meta`: detector/model metadata
