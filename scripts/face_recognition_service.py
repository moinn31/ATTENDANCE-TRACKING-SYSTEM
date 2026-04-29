"""
YOLO + ArcFace Face Recognition Service
========================================
Designed for large classrooms with 80+ students.

This service provides:
  1. Face detection via YOLO face model OR InsightFace's built-in detector.
  2. Face embedding extraction via ArcFace (InsightFace).
  3. Matching against enrolled student embeddings using cosine similarity.

Compatible with insightface 0.2.x (pre-built wheel) AND 0.7.x (source build).
"""

import base64
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# Conditional imports with graceful degradation
# ---------------------------------------------------------------------------

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
    import insightface
    INSIGHTFACE_AVAILABLE = True
    INSIGHTFACE_IMPORT_ERROR = None
    INSIGHTFACE_VERSION = getattr(insightface, '__version__', 'unknown')
except Exception as exc:
    FaceAnalysis = None  # type: ignore[assignment]
    INSIGHTFACE_AVAILABLE = False
    INSIGHTFACE_IMPORT_ERROR = str(exc)
    INSIGHTFACE_VERSION = None

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-7s | %(message)s',
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

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
YOLO_CONF_THRESHOLD = float(os.getenv('YOLO_CONF_THRESHOLD', '0.25'))  # Lower for large crowds
YOLO_IMG_SIZE = int(os.getenv('YOLO_IMG_SIZE', '1280'))  # Higher res for 80+ faces
USE_GPU = _to_bool(os.getenv('USE_CUDA', 'false'))
MAX_FACES = int(os.getenv('MAX_FACES', '150'))  # Support up to 150 faces per frame
DET_SIZE = int(os.getenv('DET_SIZE', '1280'))  # Increased for small/far faces

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title='YOLO + ArcFace Recognition Service')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request / Response Models
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Global model holders
# ---------------------------------------------------------------------------

_yolo_detector: Optional[Any] = None
_face_analyzer: Optional[Any] = None
_detection_mode: str = 'uninitialized'  # 'yolo+insightface', 'insightface_only', 'yolo_only'


# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------

def _decode_base64_image(image_base64: str) -> Any:
    """Decode a base64-encoded image to a numpy BGR array."""
    if not OPENCV_AVAILABLE or not NUMPY_AVAILABLE or cv2 is None or np is None:
        raise HTTPException(status_code=503, detail='OpenCV/Numpy dependencies are unavailable')

    value = image_base64
    if ',' in value:
        value = value.split(',', 1)[1]

    try:
        raw = base64.b64decode(value)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f'Invalid base64 payload: {exc}')

    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail='Unable to decode image bytes')

    return image


def _normalize(vec: 'np.ndarray') -> 'np.ndarray':
    norm = float(np.linalg.norm(vec))
    if norm <= 0:
        return vec
    return vec / norm


def _cosine_similarity(left: 'np.ndarray', right: 'np.ndarray') -> float:
    left_n = _normalize(left)
    right_n = _normalize(right)
    return float(np.dot(left_n, right_n))


def _clip_bbox(xyxy: Any, width: int, height: int) -> Tuple[int, int, int, int]:
    if isinstance(xyxy, (list, tuple)):
        x1, y1, x2, y2 = [int(v) for v in xyxy[:4]]
    else:
        x1, y1, x2, y2 = [int(v) for v in xyxy.tolist()[:4]]
    x1 = max(0, min(x1, width - 1))
    y1 = max(0, min(y1, height - 1))
    x2 = max(x1 + 1, min(x2, width))
    y2 = max(y1 + 1, min(y2, height))
    return x1, y1, x2, y2


# ---------------------------------------------------------------------------
# Model initialization
# ---------------------------------------------------------------------------

def _init_insightface() -> Optional[Any]:
    """Initialize InsightFace FaceAnalysis, compatible with v0.2.x and v0.7.x."""
    global _face_analyzer
    if _face_analyzer is not None:
        return _face_analyzer

    if not INSIGHTFACE_AVAILABLE or FaceAnalysis is None:
        logger.warning(f'InsightFace unavailable: {INSIGHTFACE_IMPORT_ERROR}')
        return None

    logger.info(f'Initializing InsightFace (version {INSIGHTFACE_VERSION}), model: {ARCFACE_MODEL}')

    try:
        # Try v0.7.x API first (has providers kwarg)
        try:
            providers = ['CPUExecutionProvider']
            if USE_GPU:
                providers.insert(0, 'CUDAExecutionProvider')
            _face_analyzer = FaceAnalysis(name=ARCFACE_MODEL, providers=providers)
            _face_analyzer.prepare(ctx_id=0 if USE_GPU else -1, det_size=(DET_SIZE, DET_SIZE))
            logger.info('InsightFace initialized with v0.7.x API')
        except TypeError:
            # Fall back to v0.2.x API (no providers kwarg)
            _face_analyzer = FaceAnalysis(name=ARCFACE_MODEL)
            _face_analyzer.prepare(ctx_id=0 if USE_GPU else -1, det_thresh=0.2, det_size=(DET_SIZE, DET_SIZE))
            logger.info('InsightFace initialized with v0.2.x API')

        return _face_analyzer
    except Exception as exc:
        logger.error(f'Failed to initialize InsightFace: {exc}')
        _face_analyzer = None
        return None


def _init_yolo() -> Optional[Any]:
    """Initialize YOLO face detector if the model file exists."""
    global _yolo_detector
    if _yolo_detector is not None:
        return _yolo_detector

    if not ULTRALYTICS_AVAILABLE or YOLO is None:
        logger.warning(f'Ultralytics unavailable: {ULTRALYTICS_IMPORT_ERROR}')
        return None

    if not os.path.exists(YOLO_FACE_MODEL):
        logger.warning(f'YOLO face model not found at: {YOLO_FACE_MODEL}')
        logger.info('Will use InsightFace built-in detector instead (works great for 80+ faces)')
        return None

    try:
        _yolo_detector = YOLO(YOLO_FACE_MODEL)
        logger.info(f'YOLO detector loaded: {YOLO_FACE_MODEL}')
        return _yolo_detector
    except Exception as exc:
        logger.error(f'Failed to load YOLO model: {exc}')
        return None


def _ensure_models() -> Tuple[Optional[Any], Optional[Any]]:
    """Ensure at least one detection+recognition pipeline is ready."""
    global _detection_mode

    yolo = _init_yolo()
    analyzer = _init_insightface()

    if analyzer is not None and yolo is not None:
        _detection_mode = 'yolo+insightface'
    elif analyzer is not None:
        _detection_mode = 'insightface_only'
    elif yolo is not None:
        _detection_mode = 'yolo_only'
    else:
        raise HTTPException(
            status_code=503,
            detail=(
                'No face detection/recognition backend available. '
                f'YOLO: {ULTRALYTICS_IMPORT_ERROR or "model file missing"}, '
                f'InsightFace: {INSIGHTFACE_IMPORT_ERROR or "init failed"}'
            ),
        )

    return yolo, analyzer


# ---------------------------------------------------------------------------
# Recognition pipeline
# ---------------------------------------------------------------------------

def _recognize_insightface_only(
    frame: 'np.ndarray',
    student_vectors: List[Tuple[StudentEmbedding, 'np.ndarray']],
) -> Tuple[int, List[Dict]]:
    """
    Use InsightFace for BOTH detection AND recognition.
    This is the preferred mode for 80+ students — InsightFace's RetinaFace
    detector handles dense crowds well at higher det_size.
    """
    analyzer = _face_analyzer
    if analyzer is None:
        return 0, []

    # Detect all faces in the frame (max_num=0 means no limit)
    # For small faces, we ensure the image is large enough
    h, w = frame.shape[:2]
    if max(h, w) < DET_SIZE:
        scale = DET_SIZE / max(h, w)
        frame_resized = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
        faces = analyzer.get(frame_resized, max_num=MAX_FACES)
        # Rescale bboxes back
        for face in faces:
            face.bbox /= scale
    else:
        faces = analyzer.get(frame, max_num=MAX_FACES)
    face_count = len(faces)

    if face_count == 0:
        return 0, []

    matches = []
    frame_h, frame_w = frame.shape[:2]

    for face in faces:
        face_embedding = np.asarray(face.embedding, dtype=np.float32)
        if face_embedding.size == 0:
            continue

        det_score = float(getattr(face, 'det_score', 0.0))
        bbox = getattr(face, 'bbox', None)

        # Find the best matching student
        best_student: Optional[StudentEmbedding] = None
        best_similarity = -1.0
        for student, vector in student_vectors:
            similarity = _cosine_similarity(face_embedding, vector)
            if similarity > best_similarity:
                best_similarity = similarity
                best_student = student

        if best_student is None or best_similarity < SIMILARITY_THRESHOLD:
            continue

        bbox_dict = {}
        if bbox is not None:
            x1, y1, x2, y2 = _clip_bbox(bbox, frame_w, frame_h)
            bbox_dict = {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2}

        matches.append({
            'student_id': best_student.id,
            'name': best_student.name,
            'roll_number': best_student.roll_number,
            'similarity': round(best_similarity, 4),
            'confidence': round(max(0.0, min(1.0, best_similarity)) * 100, 2),
            'bbox': bbox_dict,
            'detector_confidence': round(det_score, 4),
        })

    return face_count, matches


def _recognize_yolo_plus_insightface(
    frame: 'np.ndarray',
    student_vectors: List[Tuple[StudentEmbedding, 'np.ndarray']],
) -> Tuple[int, List[Dict]]:
    """
    Use YOLO for detection, InsightFace for embedding extraction.
    """
    detector = _yolo_detector
    analyzer = _face_analyzer

    if detector is None or analyzer is None:
        return 0, []

    yolo_results = detector.predict(
        source=[frame],
        conf=YOLO_CONF_THRESHOLD,
        imgsz=YOLO_IMG_SIZE,
        verbose=False,
        device=0 if USE_GPU else 'cpu',
        max_det=MAX_FACES,
    )

    yolo_result = yolo_results[0] if yolo_results else None
    boxes = yolo_result.boxes if yolo_result is not None else None
    box_count = int(len(boxes.xyxy)) if boxes is not None and boxes.xyxy is not None else 0

    if box_count == 0:
        return 0, []

    frame_h, frame_w = frame.shape[:2]
    matches = []

    for index in range(box_count):
        xyxy = boxes.xyxy[index]
        x1, y1, x2, y2 = _clip_bbox(xyxy, frame_w, frame_h)
        confidence = float(boxes.conf[index].item()) if boxes.conf is not None else 0.0

        # Pad the crop slightly for better embedding extraction
        pad_x = int((x2 - x1) * 0.15)
        pad_y = int((y2 - y1) * 0.15)
        cx1 = max(0, x1 - pad_x)
        cy1 = max(0, y1 - pad_y)
        cx2 = min(frame_w, x2 + pad_x)
        cy2 = min(frame_h, y2 + pad_y)

        crop = frame[cy1:cy2, cx1:cx2]
        if crop.size == 0:
            continue

        face_candidates = analyzer.get(crop, max_num=1)
        if not face_candidates:
            continue

        best_face = max(face_candidates, key=lambda f: float(getattr(f, 'det_score', 0.0)))
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

        matches.append({
            'student_id': best_student.id,
            'name': best_student.name,
            'roll_number': best_student.roll_number,
            'similarity': round(best_similarity, 4),
            'confidence': round(max(0.0, min(1.0, best_similarity)) * 100, 2),
            'bbox': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
            'detector_confidence': round(confidence, 4),
        })

    return box_count, matches


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.on_event('startup')
async def startup_event():
    """Pre-load models on startup for faster first request."""
    logger.info('='*60)
    logger.info('YOLO + ArcFace Face Recognition Service')
    logger.info('Optimized for large classrooms (80+ students)')
    logger.info('='*60)
    try:
        _ensure_models()
        logger.info(f'Detection mode: {_detection_mode}')
        logger.info(f'Max faces per frame: {MAX_FACES}')
        logger.info(f'Similarity threshold: {SIMILARITY_THRESHOLD}')
        logger.info(f'Detection size: {DET_SIZE}x{DET_SIZE}')
        logger.info('Models loaded successfully — service ready!')
    except Exception as exc:
        logger.error(f'Model initialization failed: {exc}')
        logger.warning('Service started in degraded mode. Check /health for details.')


@app.get('/health')
def health() -> dict:
    return {
        'status': 'ok',
        'detection_mode': _detection_mode,
        'max_faces': MAX_FACES,
        'yolo_model': YOLO_FACE_MODEL,
        'yolo_model_exists': os.path.exists(YOLO_FACE_MODEL),
        'arcface_model': ARCFACE_MODEL,
        'yolo_backend_available': ULTRALYTICS_AVAILABLE,
        'yolo_import_error': ULTRALYTICS_IMPORT_ERROR,
        'opencv_available': OPENCV_AVAILABLE,
        'opencv_import_error': OPENCV_IMPORT_ERROR,
        'numpy_available': NUMPY_AVAILABLE,
        'numpy_import_error': NUMPY_IMPORT_ERROR,
        'insightface_available': INSIGHTFACE_AVAILABLE,
        'insightface_version': INSIGHTFACE_VERSION,
        'insightface_import_error': INSIGHTFACE_IMPORT_ERROR,
        'embedding_backend': 'insightface' if INSIGHTFACE_AVAILABLE else 'unavailable',
        'similarity_threshold': SIMILARITY_THRESHOLD,
        'yolo_conf_threshold': YOLO_CONF_THRESHOLD,
        'det_size': DET_SIZE,
        'use_gpu': USE_GPU,
    }


@app.post('/recognize')
def recognize(req: RecognizeRequest) -> dict:
    start_time = time.time()
    _ensure_models()

    if len(req.students) == 0:
        return {'matches': [], 'message': 'No enrolled students provided'}

    # Pre-compute student vectors
    student_vectors: List[Tuple[StudentEmbedding, np.ndarray]] = []
    for student in req.students:
        vec = np.asarray(student.embedding, dtype=np.float32)
        if vec.size == 0:
            continue
        student_vectors.append((student, vec))

    # Collect frames
    frames_base64 = req.images_base64 if req.images_base64 is not None else []
    if req.image_base64:
        frames_base64 = [req.image_base64]

    if len(frames_base64) == 0:
        raise HTTPException(status_code=400, detail='Provide image_base64 or images_base64')

    frames = [_decode_base64_image(b64) for b64 in frames_base64]

    # Choose recognition pipeline based on detection mode
    recognize_fn = (
        _recognize_yolo_plus_insightface
        if _detection_mode == 'yolo+insightface'
        else _recognize_insightface_only
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

        face_count, matches = recognize_fn(frame, student_vectors)
        total_face_candidates += face_count

        # Deduplicate: keep highest similarity per student
        deduped: Dict[str, Dict] = {}
        for match in matches:
            sid = match['student_id']
            if sid not in deduped or match['similarity'] > deduped[sid]['similarity']:
                deduped[sid] = match

        frame_matches = list(deduped.values())
        total_matches += len(frame_matches)

        batch_results.append({
            'frame_index': frame_index,
            'face_candidates': face_count,
            'matches': frame_matches,
        })

    elapsed = round(time.time() - start_time, 3)

    # Single-frame response (backwards compatible)
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
                'detection_mode': _detection_mode,
                'elapsed_seconds': elapsed,
            },
        }

    # Multi-frame response
    return {
        'batch_results': batch_results,
        'message': 'ok',
        'meta': {
            'frames': int(len(batch_results)),
            'face_candidates': int(total_face_candidates),
            'matched_students': int(total_matches),
            'yolo_model': YOLO_FACE_MODEL,
            'arcface_model': ARCFACE_MODEL,
            'detection_mode': _detection_mode,
            'elapsed_seconds': elapsed,
        },
    }
