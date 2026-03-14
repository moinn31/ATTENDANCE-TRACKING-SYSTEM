from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title='YOLOv8 + ArcFace Recognition Service')


class StudentEmbedding(BaseModel):
    id: str
    name: str
    roll_number: Optional[str] = None
    embedding: List[float]


class RecognizeRequest(BaseModel):
    image_base64: str
    students: List[StudentEmbedding]


@app.get('/health')
def health() -> dict:
    return {'status': 'ok'}


@app.post('/recognize')
def recognize(req: RecognizeRequest) -> dict:
    # Placeholder service contract for YOLOv8 + ArcFace integration.
    # Replace this with actual model inference logic:
    # 1) decode image_base64
    # 2) run YOLOv8-face detection
    # 3) run ArcFace embedding extraction for each detected face
    # 4) compare with req.students embeddings and return matched IDs
    return {
        'matches': [],
        'message': 'Model inference not yet implemented. Service contract is ready.'
    }
