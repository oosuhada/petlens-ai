from __future__ import annotations

import io
import json
import os
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import requests
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel, Field
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    AutoModelForZeroShotObjectDetection,
    AutoProcessor,
    CLIPModel,
    CLIPProcessor,
)


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "pets.json"
REMOTE_IMAGE_HEADERS = {"User-Agent": "PetLens academic demo/1.0 (local coursework)"}

DEFAULT_VIT_MODEL = "rakib730/vit-base-oxford-iiit-pets"
DEFAULT_CLIP_MODEL = "openai/clip-vit-large-patch14"
DEFAULT_DETECTOR_MODEL = "IDEA-Research/grounding-dino-tiny"

VIT_MODEL = os.getenv("PETLENS_VIT_MODEL", DEFAULT_VIT_MODEL)
CLIP_MODEL_NAME = os.getenv("PETLENS_CLIP_MODEL", DEFAULT_CLIP_MODEL)
DETECTOR_MODEL = os.getenv("PETLENS_DETECTOR_MODEL", DEFAULT_DETECTOR_MODEL)
DETECTION_THRESHOLD = float(os.getenv("PETLENS_DETECTION_THRESHOLD", "0.32"))
DETECTION_TEXT_THRESHOLD = float(os.getenv("PETLENS_DETECTION_TEXT_THRESHOLD", "0.25"))
DETECTION_LABELS = ["dog", "cat"]
GALLERY_CACHE_PATH = Path(
    os.getenv(
        "PETLENS_GALLERY_CACHE",
        str(ROOT / ".cache" / f"gallery-{CLIP_MODEL_NAME.replace('/', '--')}.npy"),
    )
)
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "PETLENS_CORS_ORIGINS",
        "http://127.0.0.1:3000,http://localhost:3000,http://127.0.0.1:3107,http://localhost:3107",
    ).split(",")
    if origin.strip()
]


def pick_device() -> torch.device:
    requested = os.getenv("PETLENS_DEVICE", "auto").strip().lower()
    if requested == "cpu":
        return torch.device("cpu")
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


DEVICE = pick_device()


with CATALOG_PATH.open("r", encoding="utf-8") as handle:
    CATALOG: list[dict[str, Any]] = json.load(handle)


class TextSearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=180)
    top_k: int = Field(default=12, ge=1, le=37)


class Runtime:
    def __init__(self) -> None:
        self.vit_processor = None
        self.vit_model = None
        self.clip_processor = None
        self.clip_model = None
        self.detector_processor = None
        self.detector_model = None
        self.detector_error: str | None = None
        self.gallery_embeddings: np.ndarray | None = None

    def load_vit(self) -> None:
        if self.vit_model is not None:
            return
        self.vit_processor = AutoImageProcessor.from_pretrained(VIT_MODEL)
        self.vit_model = AutoModelForImageClassification.from_pretrained(VIT_MODEL)
        self.vit_model = self.vit_model.to(DEVICE).eval()

    def load_clip(self) -> None:
        if self.clip_model is not None:
            return
        self.clip_processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
        self.clip_model = CLIPModel.from_pretrained(CLIP_MODEL_NAME)
        self.clip_model = self.clip_model.to(DEVICE).eval()

    def load_detector(self) -> None:
        if self.detector_model is not None:
            return
        if self.detector_error:
            raise RuntimeError(self.detector_error)
        try:
            self.detector_processor = AutoProcessor.from_pretrained(DETECTOR_MODEL)
            self.detector_model = AutoModelForZeroShotObjectDetection.from_pretrained(DETECTOR_MODEL)
            self.detector_model = self.detector_model.to(DEVICE).eval()
        except Exception as exc:
            self.detector_error = str(exc)
            raise

    def classify(self, image: Image.Image) -> list[dict[str, Any]]:
        self.load_vit()
        inputs = self.vit_processor(images=image, return_tensors="pt")
        inputs = {key: value.to(DEVICE) for key, value in inputs.items()}
        with torch.inference_mode():
            logits = self.vit_model(**inputs).logits[0]
            probabilities = F.softmax(logits, dim=-1)
            values, indices = torch.topk(probabilities, k=min(5, probabilities.shape[-1]))

        results = []
        for value, index in zip(values.cpu().tolist(), indices.cpu().tolist()):
            label = self.vit_model.config.id2label.get(index, str(index))
            results.append({"label": str(label), "confidence": float(value)})
        return results

    @staticmethod
    def _normalize(features: torch.Tensor) -> torch.Tensor:
        return features / features.norm(dim=-1, keepdim=True).clamp(min=1e-12)

    def image_embedding(self, images: list[Image.Image]) -> np.ndarray:
        self.load_clip()
        inputs = self.clip_processor(images=images, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(DEVICE)
        with torch.inference_mode():
            features = self.clip_model.get_image_features(pixel_values=pixel_values)
            features = self._normalize(features)
        return features.detach().cpu().numpy().astype(np.float32)

    def text_embedding(self, texts: list[str]) -> np.ndarray:
        self.load_clip()
        inputs = self.clip_processor(
            text=texts,
            padding=True,
            truncation=True,
            return_tensors="pt",
        )
        input_ids = inputs["input_ids"].to(DEVICE)
        attention_mask = inputs["attention_mask"].to(DEVICE)
        with torch.inference_mode():
            features = self.clip_model.get_text_features(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )
            features = self._normalize(features)
        return features.detach().cpu().numpy().astype(np.float32)

    def ensure_gallery_index(self) -> None:
        if self.gallery_embeddings is not None:
            return

        if GALLERY_CACHE_PATH.exists():
            try:
                cached = np.load(GALLERY_CACHE_PATH)
                if cached.ndim == 2 and cached.shape[0] == len(CATALOG):
                    self.gallery_embeddings = cached.astype(np.float32)
                    return
            except Exception:
                pass

        def load_catalog_image(pet: dict[str, Any]) -> Image.Image:
            try:
                response = requests.get(pet["image"], headers=REMOTE_IMAGE_HEADERS, timeout=20)
                response.raise_for_status()
                return Image.open(io.BytesIO(response.content)).convert("RGB")
            except Exception as exc:  # pragma: no cover - depends on remote dataset availability
                raise RuntimeError(f"Failed to load Oxford-IIIT Pet sample: {pet['id']}") from exc

        with ThreadPoolExecutor(max_workers=min(8, len(CATALOG))) as executor:
            gallery_images = list(executor.map(load_catalog_image, CATALOG))

        embeddings: list[np.ndarray] = []
        batch_size = 8
        for start in range(0, len(gallery_images), batch_size):
            embeddings.append(self.image_embedding(gallery_images[start:start + batch_size]))

        self.gallery_embeddings = np.concatenate(embeddings, axis=0)
        GALLERY_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        np.save(GALLERY_CACHE_PATH, self.gallery_embeddings)

    def rank(self, query_embedding: np.ndarray, top_k: int) -> list[dict[str, Any]]:
        self.ensure_gallery_index()
        scores = query_embedding @ self.gallery_embeddings.T
        scores = scores[0]
        indices = np.argsort(-scores)[:top_k]
        return [
            {"id": CATALOG[int(index)]["id"], "score": float(scores[int(index)])}
            for index in indices
        ]

    @staticmethod
    def _box_iou(first: list[float], second: list[float]) -> float:
        ax0, ay0, ax1, ay1 = first
        bx0, by0, bx1, by1 = second
        ix0 = max(ax0, bx0)
        iy0 = max(ay0, by0)
        ix1 = min(ax1, bx1)
        iy1 = min(ay1, by1)
        intersection = max(0.0, ix1 - ix0) * max(0.0, iy1 - iy0)
        if intersection <= 0:
            return 0.0
        first_area = max(0.0, ax1 - ax0) * max(0.0, ay1 - ay0)
        second_area = max(0.0, bx1 - bx0) * max(0.0, by1 - by0)
        union = first_area + second_area - intersection
        return intersection / union if union > 0 else 0.0

    @staticmethod
    def _normalize_detector_label(label: str) -> str | None:
        normalized = label.strip().lower()
        if "dog" in normalized:
            return "dog"
        if "cat" in normalized:
            return "cat"
        return None

    @staticmethod
    def _box_payload(box: list[float], width: int, height: int) -> dict[str, Any]:
        x0, y0, x1, y1 = box
        x0 = max(0.0, min(float(width), x0))
        y0 = max(0.0, min(float(height), y0))
        x1 = max(x0, min(float(width), x1))
        y1 = max(y0, min(float(height), y1))
        box_width = x1 - x0
        box_height = y1 - y0
        return {
            "x": round(x0, 2),
            "y": round(y0, 2),
            "width": round(box_width, 2),
            "height": round(box_height, 2),
            "normalized": {
                "x": x0 / width if width else 0.0,
                "y": y0 / height if height else 0.0,
                "width": box_width / width if width else 1.0,
                "height": box_height / height if height else 1.0,
            },
        }

    @staticmethod
    def _crop_with_padding(image: Image.Image, box: list[float], padding_ratio: float = 0.06) -> Image.Image:
        width, height = image.size
        x0, y0, x1, y1 = box
        box_width = max(1.0, x1 - x0)
        box_height = max(1.0, y1 - y0)
        pad_x = box_width * padding_ratio
        pad_y = box_height * padding_ratio
        crop_box = (
            max(0, int(round(x0 - pad_x))),
            max(0, int(round(y0 - pad_y))),
            min(width, int(round(x1 + pad_x))),
            min(height, int(round(y1 + pad_y))),
        )
        return image.crop(crop_box)

    def detect_pets(self, image: Image.Image, max_pets: int = 6) -> list[dict[str, Any]]:
        self.load_detector()
        width, height = image.size
        inputs = self.detector_processor(
            images=image,
            text=DETECTION_LABELS,
            return_tensors="pt",
        )
        model_inputs = {
            key: value.to(DEVICE) if hasattr(value, "to") else value
            for key, value in inputs.items()
        }
        with torch.inference_mode():
            outputs = self.detector_model(**model_inputs)

        processed = self.detector_processor.post_process_grounded_object_detection(
            outputs,
            input_ids=model_inputs.get("input_ids"),
            threshold=DETECTION_THRESHOLD,
            text_threshold=DETECTION_TEXT_THRESHOLD,
            target_sizes=[(height, width)],
        )[0]

        scores = processed.get("scores", [])
        boxes = processed.get("boxes", [])
        labels = processed.get("text_labels") or processed.get("labels") or []
        candidates: list[dict[str, Any]] = []
        image_area = max(1, width * height)

        for raw_score, raw_box, raw_label in zip(scores, boxes, labels):
            score = float(raw_score.detach().cpu().item() if hasattr(raw_score, "detach") else raw_score)
            box_values = raw_box.detach().cpu().tolist() if hasattr(raw_box, "detach") else list(raw_box)
            box = [float(value) for value in box_values]
            species = self._normalize_detector_label(str(raw_label))
            if not species:
                continue
            x0, y0, x1, y1 = box
            area = max(0.0, x1 - x0) * max(0.0, y1 - y0)
            if area / image_area < 0.004:
                continue
            candidates.append({"species": species, "score": score, "box": box})

        candidates.sort(key=lambda item: item["score"], reverse=True)
        selected: list[dict[str, Any]] = []
        for candidate in candidates:
            duplicate = any(
                self._box_iou(candidate["box"], existing["box"]) >= 0.72
                for existing in selected
            )
            if duplicate:
                continue
            selected.append(candidate)
            if len(selected) >= max_pets:
                break
        return selected


runtime = Runtime()

app = FastAPI(
    title="PetLens ML Service",
    description="Pet detection, ViT breed classification, and CLIP semantic retrieval pipeline.",
    version="2.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def read_image(file: UploadFile) -> Image.Image:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")
    payload = await file.read()
    if len(payload) > 12 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be smaller than 12 MB.")
    try:
        return Image.open(io.BytesIO(payload)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Unable to decode the uploaded image.") from exc


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "device": str(DEVICE),
        "vit_model": VIT_MODEL,
        "vit_model_source": "user_checkpoint" if os.getenv("PETLENS_VIT_MODEL") else "public_fallback",
        "clip_model": CLIP_MODEL_NAME,
        "detector_model": DETECTOR_MODEL,
        "detector_ready": runtime.detector_model is not None,
        "detector_error": runtime.detector_error,
        "gallery_size": len(CATALOG),
        "gallery_index_ready": runtime.gallery_embeddings is not None,
        "gallery_cache_ready": GALLERY_CACHE_PATH.exists(),
    }


@app.post("/classify")
async def classify(file: UploadFile = File(...)) -> dict[str, Any]:
    image = await read_image(file)
    try:
        predictions = runtime.classify(image)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"ViT model unavailable: {exc}") from exc
    return {
        "predictions": predictions,
        "model": VIT_MODEL,
        "model_source": "user_checkpoint" if os.getenv("PETLENS_VIT_MODEL") else "public_fallback",
    }


@app.post("/search/text")
def search_text(request: TextSearchRequest) -> dict[str, Any]:
    try:
        query = runtime.text_embedding([request.query])
        results = runtime.rank(query, request.top_k)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"CLIP search unavailable: {exc}") from exc
    return {"query": request.query, "results": results, "model": CLIP_MODEL_NAME}


@app.post("/search/image")
async def search_image(
    file: UploadFile = File(...),
    top_k: int = Query(default=12, ge=1, le=37),
) -> dict[str, Any]:
    image = await read_image(file)
    try:
        query = runtime.image_embedding([image])
        results = runtime.rank(query, top_k)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"CLIP search unavailable: {exc}") from exc
    return {"results": results, "model": CLIP_MODEL_NAME}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    top_k: int = Query(default=16, ge=1, le=37),
    max_pets: int = Query(default=6, ge=1, le=8),
) -> dict[str, Any]:
    image = await read_image(file)
    width, height = image.size

    detection_status = "detected"
    detection_error = None
    try:
        detections = runtime.detect_pets(image, max_pets=max_pets)
    except Exception as exc:
        detections = []
        detection_status = "detector_unavailable_fallback"
        detection_error = str(exc)

    if not detections:
        if detection_status == "detected":
            detection_status = "no_pet_detected_fallback"
        detections = [
            {
                "species": "unknown",
                "score": None,
                "box": [0.0, 0.0, float(width), float(height)],
                "fallback": True,
            }
        ]

    crops = [runtime._crop_with_padding(image, detection["box"]) for detection in detections]
    try:
        predictions_by_pet = [runtime.classify(crop) for crop in crops]
        embeddings = runtime.image_embedding(crops)
        matches_by_pet = [
            runtime.rank(embeddings[index:index + 1], top_k)
            for index in range(len(crops))
        ]
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Pet analysis unavailable: {exc}") from exc

    pets: list[dict[str, Any]] = []
    for index, detection in enumerate(detections):
        pets.append(
            {
                "id": f"pet-{index + 1}",
                "species": detection["species"],
                "detector_score": detection.get("score"),
                "fallback": bool(detection.get("fallback", False)),
                "box": runtime._box_payload(detection["box"], width, height),
                "predictions": predictions_by_pet[index],
                "results": matches_by_pet[index],
            }
        )

    primary_pet = pets[0]
    detected_pet_count = sum(1 for pet in pets if not pet["fallback"])
    return {
        "version": "2.0",
        "image": {"width": width, "height": height},
        "detection": {
            "status": detection_status,
            "model": DETECTOR_MODEL,
            "threshold": DETECTION_THRESHOLD,
            "error": detection_error,
        },
        "detected_pet_count": detected_pet_count,
        "analysis_subject_count": len(pets),
        "primary_pet_id": primary_pet["id"],
        "pets": pets,
        "predictions": primary_pet["predictions"],
        "results": primary_pet["results"],
        "models": {
            "detector": DETECTOR_MODEL,
            "classifier": VIT_MODEL,
            "retrieval": CLIP_MODEL_NAME,
        },
    }
