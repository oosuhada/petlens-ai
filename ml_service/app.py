from __future__ import annotations

import io
import json
import os
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
    CLIPModel,
    CLIPProcessor,
)


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "pets.json"
REMOTE_IMAGE_HEADERS = {"User-Agent": "PetLens academic demo/1.0 (local coursework)"}

DEFAULT_VIT_MODEL = "rakib730/vit-base-oxford-iiit-pets"
DEFAULT_CLIP_MODEL = "openai/clip-vit-large-patch14"

VIT_MODEL = os.getenv("PETLENS_VIT_MODEL", DEFAULT_VIT_MODEL)
CLIP_MODEL_NAME = os.getenv("PETLENS_CLIP_MODEL", DEFAULT_CLIP_MODEL)
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

        embeddings: list[np.ndarray] = []
        batch: list[Image.Image] = []
        batch_size = 8

        for index, pet in enumerate(CATALOG):
            try:
                response = requests.get(pet["image"], headers=REMOTE_IMAGE_HEADERS, timeout=20)
                response.raise_for_status()
                batch.append(Image.open(io.BytesIO(response.content)).convert("RGB"))
            except Exception as exc:  # pragma: no cover - depends on remote dataset availability
                raise RuntimeError(f"Failed to load Oxford-IIIT Pet sample: {pet['id']}") from exc

            if len(batch) == batch_size or index == len(CATALOG) - 1:
                embeddings.append(self.image_embedding(batch))
                batch = []

        self.gallery_embeddings = np.concatenate(embeddings, axis=0)

    def rank(self, query_embedding: np.ndarray, top_k: int) -> list[dict[str, Any]]:
        self.ensure_gallery_index()
        scores = query_embedding @ self.gallery_embeddings.T
        scores = scores[0]
        indices = np.argsort(-scores)[:top_k]
        return [
            {"id": CATALOG[int(index)]["id"], "score": float(scores[int(index)])}
            for index in indices
        ]


runtime = Runtime()

app = FastAPI(
    title="PetLens ML Service",
    description="ViT breed classification and CLIP semantic retrieval adapter.",
    version="1.0.0",
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
        "gallery_size": len(CATALOG),
        "gallery_index_ready": runtime.gallery_embeddings is not None,
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
