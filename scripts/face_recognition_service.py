import base64
import os
from typing import Any, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
try:
    import cv2

    OPENCV_AVAILABLE = True
    OPENCV_IMPORT_ERROR = None
except Exception as exc:
    cv2 = None  # type: ignore[assignment]
    OPENCV_AVAILABLE = False
    OPENCV_IMPORT_ERROR = str(exc)

try:
    import numpy as np

    NUMPY_AVAILABLE = True
    NUMPY_IMPORT_ERROR = None
except Exception as exc:
    np = None  # type: ignore[assignment]
    NUMPY_AVAILABLE = False
    NUMPY_IMPORT_ERROR = str(exc)

try:
    from ultralytics import YOLO

    ULTRALYTICS_AVAILABLE = True
    ULTRALYTICS_IMPORT_ERROR = None
except Exception as exc:
    YOLO = None  # type: ignore[assignment]
    ULTRALYTICS_AVAILABLE = False
    ULTRALYTICS_IMPORT_ERROR = str(exc)

try:
    from insightface.app import FaceAnalysis

    INSIGHTFACE_AVAILABLE = True
    INSIGHTFACE_IMPORT_ERROR = None
except Exception as exc:
    FaceAnalysis = None  # type: ignore[assignment]
    INSIGHTFACE_AVAILABLE = False
    INSIGHTFACE_IMPORT_ERROR = str(exc)


app = FastAPI(title='YOLO + ArcFace Recognition Service')


class StudentEmbedding(BaseModel):
    id: str
    name: str
    roll_number: Optional[str] = None
    embedding: List[float]


class RecognizeRequest(BaseModel):
    image_base64: Optional[str] = None
    images_base64: Optional[List[str]] = None
    frame_indices: Optional[List[int]] = None
    students: List[StudentEmbedding]


def _to_bool(value: str) -> bool:
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _resolve_model_path(path_value: str) -> str:
    if os.path.isabs(path_value):
        return path_value

    if os.path.exists(path_value):
        return path_value

    script_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(script_dir, path_value)


YOLO_FACE_MODEL = _resolve_model_path(os.getenv('YOLO_FACE_MODEL', 'models/yolov8m-face.pt'))
ARCFACE_MODEL = os.getenv('ARCFACE_MODEL', 'buffalo_l')
SIMILARITY_THRESHOLD = float(os.getenv('FACE_SIMILARITY_THRESHOLD', '0.40'))
YOLO_CONF_THRESHOLD = float(os.getenv('YOLO_CONF_THRESHOLD', '0.35'))
YOLO_IMG_SIZE = int(os.getenv('YOLO_IMG_SIZE', '960'))
USE_GPU = _to_bool(os.getenv('USE_CUDA', 'false'))

_detector: Optional[Any] = None
_recognizer: Optional[Any] = None


def _decode_base64_image(image_base64: str) -> Any:
    if not OPENCV_AVAILABLE or not NUMPY_AVAILABLE or cv2 is None or np is None:
        raise HTTPException(status_code=503, detail='OpenCV/Numpy dependencies are unavailable')

    value = image_base64
    if ',' in value:
        value = value.split(',', 1)[1]

    try:
        raw = base64.b64decode(value)
    except Exception as exc:  # pragma: no cover - defensive decode guard
        raise HTTPException(status_code=400, detail=f'Invalid base64 payload: {exc}')

    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail='Unable to decode image bytes')

    return image


def _normalize(vec: np.ndarray) -> np.ndarray:
    norm = float(np.linalg.norm(vec))
    if norm <= 0:
        return vec
    return vec / norm


def _cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    left_n = _normalize(left)
    right_n = _normalize(right)
    return float(np.dot(left_n, right_n))


def _clip_bbox(xyxy: np.ndarray, width: int, height: int) -> Tuple[int, int, int, int]:
    x1, y1, x2, y2 = [int(v) for v in xyxy.tolist()]
    x1 = max(0, min(x1, width - 1))
    y1 = max(0, min(y1, height - 1))
    x2 = max(x1 + 1, min(x2, width))
    y2 = max(y1 + 1, min(y2, height))
    return x1, y1, x2, y2


def _ensure_models() -> Tuple[Any, Optional[Any]]:
    global _detector, _recognizer

    if not ULTRALYTICS_AVAILABLE or YOLO is None:
        raise HTTPException(
            status_code=503,
            detail=(
                'YOLO detector backend is unavailable. '
                f'ultralytics import failed: {ULTRALYTICS_IMPORT_ERROR}'
            ),
        )

    if _detector is None:
        try:
            _detector = YOLO(YOLO_FACE_MODEL)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    'Failed to load YOLO face model. '
                    f'Set YOLO_FACE_MODEL to a valid face checkpoint (current: {YOLO_FACE_MODEL}). Error: {exc}'
                ),
            )

    if _recognizer is None and INSIGHTFACE_AVAILABLE:
        providers = ['CPUExecutionProvider']
        if USE_GPU:
            providers.insert(0, 'CUDAExecutionProvider')

        try:
            _recognizer = FaceAnalysis(name=ARCFACE_MODEL, providers=providers)
            _recognizer.prepare(ctx_id=0 if USE_GPU else -1, det_size=(640, 640))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f'Failed to initialize ArcFace model: {exc}')

    return _detector, _recognizer


@app.get('/health')
def health() -> dict:
    return {
        'status': 'ok',
        'yolo_model': YOLO_FACE_MODEL,
        'yolo_model_exists': os.path.exists(YOLO_FACE_MODEL),
        'arcface_model': ARCFACE_MODEL,
        'yolo_backend_available': ULTRALYTICS_AVAILABLE,
        'yolo_import_error': ULTRALYTICS_IMPORT_ERROR,
        'opencv_available': OPENCV_AVAILABLE,
        'opencv_import_error': OPENCV_IMPORT_ERROR,
        'numpy_available': NUMPY_AVAILABLE,
        'numpy_import_error': NUMPY_IMPORT_ERROR,
        'embedding_backend': 'insightface' if INSIGHTFACE_AVAILABLE else 'unavailable',
        'insightface_available': INSIGHTFACE_AVAILABLE,
        'insightface_import_error': INSIGHTFACE_IMPORT_ERROR,
        'similarity_threshold': SIMILARITY_THRESHOLD,
        'yolo_conf_threshold': YOLO_CONF_THRESHOLD,
    }


@app.post('/recognize')
def recognize(req: RecognizeRequest) -> dict:
    detector, recognizer = _ensure_models()

    if recognizer is None:
        raise HTTPException(
            status_code=503,
            detail=(
                'ArcFace embedding backend is unavailable. '
                'Install insightface and Microsoft C++ Build Tools for full YOLO recognition on Windows.'
            ),
        )

    if len(req.students) == 0:
        return {'matches': [], 'message': 'No enrolled students provided'}

    student_vectors = []
    for student in req.students:
        vec = np.asarray(student.embedding, dtype=np.float32)
        if vec.size == 0:
            continue
        student_vectors.append((student, vec))

    frames_base64 = req.images_base64 if req.images_base64 is not None else []
    if req.image_base64:
        frames_base64 = [req.image_base64]

    if len(frames_base64) == 0:
        raise HTTPException(status_code=400, detail='Provide image_base64 or images_base64')

    frames = [_decode_base64_image(image_base64) for image_base64 in frames_base64]
    yolo_results = detector.predict(
        source=frames,
        conf=YOLO_CONF_THRESHOLD,
        imgsz=YOLO_IMG_SIZE,
        verbose=False,
        device=0 if USE_GPU else 'cpu',
    )

    batch_results = []
    total_face_candidates = 0
    total_matches = 0

    for frame_pos, frame in enumerate(frames):
        frame_index = (
            req.frame_indices[frame_pos]
            if req.frame_indices is not None and frame_pos < len(req.frame_indices)
            else frame_pos
        )
        frame_h, frame_w = frame.shape[:2]

        yolo_result = yolo_results[frame_pos] if frame_pos < len(yolo_results) else None
        boxes = yolo_result.boxes if yolo_result is not None else None
        box_count = int(len(boxes.xyxy)) if boxes is not None and boxes.xyxy is not None else 0
        total_face_candidates += box_count

        matches = []
        if boxes is not None and boxes.xyxy is not None and box_count > 0:
            for index in range(box_count):
                xyxy = boxes.xyxy[index]
                x1, y1, x2, y2 = _clip_bbox(xyxy, frame_w, frame_h)
                confidence = float(boxes.conf[index].item()) if boxes.conf is not None else 0.0

                crop = frame[y1:y2, x1:x2]
                if crop.size == 0:
                    continue

                face_candidates = recognizer.get(crop)
                if not face_candidates:
                    continue

                best_face = max(face_candidates, key=lambda face: float(getattr(face, 'det_score', 0.0)))
                face_embedding = np.asarray(best_face.embedding, dtype=np.float32)
                if face_embedding.size == 0:
                    continue

                best_student: Optional[StudentEmbedding] = None
                best_similarity = -1.0
                for student, vector in student_vectors:
                    similarity = _cosine_similarity(face_embedding, vector)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_student = student

                if best_student is None or best_similarity < SIMILARITY_THRESHOLD:
                    continue

                matches.append(
                    {
                        'student_id': best_student.id,
                        'name': best_student.name,
                        'roll_number': best_student.roll_number,
                        'similarity': round(best_similarity, 4),
                        'confidence': round(max(0.0, min(1.0, best_similarity)) * 100, 2),
                        'bbox': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
                        'detector_confidence': round(confidence, 4),
                    }
                )

        deduped = {}
        for match in matches:
            student_id = match['student_id']
            if student_id not in deduped or match['similarity'] > deduped[student_id]['similarity']:
                deduped[student_id] = match

        frame_matches = list(deduped.values())
        total_matches += len(frame_matches)
        batch_results.append(
            {
                'frame_index': frame_index,
                'face_candidates': box_count,
                'matches': frame_matches,
            }
        )

    if req.image_base64 and req.images_base64 is None:
        single = batch_results[0] if batch_results else {'matches': [], 'face_candidates': 0}
        return {
            'matches': single['matches'],
            'message': 'ok',
            'meta': {
                'face_candidates': int(single['face_candidates']),
                'matched_students': int(len(single['matches'])),
                'yolo_model': YOLO_FACE_MODEL,
                'arcface_model': ARCFACE_MODEL,
            },
        }

    return {
        'batch_results': batch_results,
        'message': 'ok',
        'meta': {
            'frames': int(len(batch_results)),
            'face_candidates': int(total_face_candidates),
            'matched_students': int(total_matches),
            'yolo_model': YOLO_FACE_MODEL,
            'arcface_model': ARCFACE_MODEL,
        },
    }
