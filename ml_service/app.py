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
    AutoModel,
    AutoImageProcessor,
    AutoModelForImageClassification,
    AutoModelForZeroShotObjectDetection,
    AutoProcessor,
    CLIPModel,
    CLIPProcessor,
    Dinov2Model,
    Sam2Model,
    Sam2Processor,
)


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "data" / "pets.json"
REMOTE_IMAGE_HEADERS = {"User-Agent": "PetLens academic demo/1.0 (local coursework)"}

DEFAULT_VIT_MODEL = "rakib730/vit-base-oxford-iiit-pets"
DEFAULT_CLIP_MODEL = "openai/clip-vit-large-patch14"
DEFAULT_DETECTOR_MODEL = "IDEA-Research/grounding-dino-tiny"
DEFAULT_SEGMENTATION_MODEL = "facebook/sam2-hiera-tiny"
DEFAULT_DINO_MODEL = "facebook/dinov2-small"
DEFAULT_SIGLIP2_MODEL = "google/siglip2-base-patch16-224"

VIT_MODEL = os.getenv("PETLENS_VIT_MODEL", DEFAULT_VIT_MODEL)
CLIP_MODEL_NAME = os.getenv("PETLENS_CLIP_MODEL", DEFAULT_CLIP_MODEL)
DETECTOR_MODEL = os.getenv("PETLENS_DETECTOR_MODEL", DEFAULT_DETECTOR_MODEL)
SEGMENTATION_MODEL = os.getenv("PETLENS_SEGMENTATION_MODEL", DEFAULT_SEGMENTATION_MODEL)
SEGMENTATION_ENABLED = os.getenv("PETLENS_SEGMENTATION_ENABLED", "1").strip().lower() not in {"0", "false", "no"}
DINO_MODEL = os.getenv("PETLENS_DINO_MODEL", DEFAULT_DINO_MODEL)
SIGLIP2_MODEL = os.getenv("PETLENS_SIGLIP2_MODEL", DEFAULT_SIGLIP2_MODEL)
DETECTION_THRESHOLD = float(os.getenv("PETLENS_DETECTION_THRESHOLD", "0.32"))
DETECTION_TEXT_THRESHOLD = float(os.getenv("PETLENS_DETECTION_TEXT_THRESHOLD", "0.25"))
DETECTION_LABELS = ["dog", "cat"]
UNKNOWN_TOP1_THRESHOLD = float(os.getenv("PETLENS_UNKNOWN_TOP1_THRESHOLD", "0.55"))
UNKNOWN_MARGIN_THRESHOLD = float(os.getenv("PETLENS_UNKNOWN_MARGIN_THRESHOLD", "0.12"))
GALLERY_CACHE_PATH = Path(
    os.getenv(
        "PETLENS_GALLERY_CACHE",
        str(ROOT / ".cache" / f"gallery-{CLIP_MODEL_NAME.replace('/', '--')}.npy"),
    )
)
DINO_GALLERY_CACHE_PATH = Path(
    os.getenv(
        "PETLENS_DINO_GALLERY_CACHE",
        str(ROOT / ".cache" / f"gallery-{DINO_MODEL.replace('/', '--')}.npy"),
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
        self.segmenter_processor = None
        self.segmenter_model = None
        self.segmenter_error: str | None = None
        self.dino_processor = None
        self.dino_model = None
        self.dino_error: str | None = None
        self.dino_gallery_embeddings: np.ndarray | None = None
        self.siglip2_processor = None
        self.siglip2_model = None
        self.siglip2_error: str | None = None
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

    def load_segmenter(self) -> None:
        if self.segmenter_model is not None:
            return
        if not SEGMENTATION_ENABLED:
            raise RuntimeError("SAM2 segmentation is disabled by PETLENS_SEGMENTATION_ENABLED.")
        if self.segmenter_error:
            raise RuntimeError(self.segmenter_error)
        try:
            self.segmenter_processor = Sam2Processor.from_pretrained(SEGMENTATION_MODEL)
            self.segmenter_model = Sam2Model.from_pretrained(SEGMENTATION_MODEL)
            self.segmenter_model = self.segmenter_model.to(DEVICE).eval()
        except Exception as exc:
            self.segmenter_error = str(exc)
            raise

    def load_dino(self) -> None:
        if self.dino_model is not None:
            return
        if self.dino_error:
            raise RuntimeError(self.dino_error)
        try:
            self.dino_processor = AutoImageProcessor.from_pretrained(DINO_MODEL)
            self.dino_model = Dinov2Model.from_pretrained(DINO_MODEL)
            self.dino_model = self.dino_model.to(DEVICE).eval()
        except Exception as exc:
            self.dino_error = str(exc)
            raise

    def load_siglip2(self) -> None:
        if self.siglip2_model is not None:
            return
        if self.siglip2_error:
            raise RuntimeError(self.siglip2_error)
        try:
            self.siglip2_processor = AutoProcessor.from_pretrained(SIGLIP2_MODEL)
            self.siglip2_model = AutoModel.from_pretrained(SIGLIP2_MODEL)
            self.siglip2_model = self.siglip2_model.to(DEVICE).eval()
        except Exception as exc:
            self.siglip2_error = str(exc)
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

    def dino_embedding(self, images: list[Image.Image]) -> np.ndarray:
        self.load_dino()
        inputs = self.dino_processor(images=images, return_tensors="pt")
        pixel_values = inputs["pixel_values"].to(DEVICE)
        with torch.inference_mode():
            outputs = self.dino_model(pixel_values=pixel_values)
            features = outputs.pooler_output
            features = self._normalize(features)
        return features.detach().cpu().numpy().astype(np.float32)

    def siglip2_zero_shot(
        self,
        image: Image.Image,
        top_k: int = 5,
        species: str | None = None,
    ) -> list[dict[str, Any]]:
        self.load_siglip2()
        candidates = [
            pet for pet in CATALOG
            if species not in {"dog", "cat"} or pet["species"] == species
        ]
        prompts = [pet["breed"] for pet in candidates]
        inputs = self.siglip2_processor(
            text=prompts,
            images=image,
            padding="max_length",
            return_tensors="pt",
        )
        model_inputs = {
            key: value.to(DEVICE) if hasattr(value, "to") else value
            for key, value in inputs.items()
        }
        with torch.inference_mode():
            outputs = self.siglip2_model(**model_inputs)
            scores = torch.sigmoid(outputs.logits_per_image[0])
            values, indices = torch.topk(scores, k=min(top_k, scores.shape[-1]))

        results: list[dict[str, Any]] = []
        for value, index in zip(values.detach().cpu().tolist(), indices.detach().cpu().tolist()):
            pet = candidates[int(index)]
            results.append(
                {
                    "id": pet["id"],
                    "breed": pet["breed"],
                    "species": pet["species"],
                    "score": float(value),
                }
            )
        return results

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

    def ensure_dino_gallery_index(self) -> None:
        if self.dino_gallery_embeddings is not None:
            return

        if DINO_GALLERY_CACHE_PATH.exists():
            try:
                cached = np.load(DINO_GALLERY_CACHE_PATH)
                if cached.ndim == 2 and cached.shape[0] == len(CATALOG):
                    self.dino_gallery_embeddings = cached.astype(np.float32)
                    return
            except Exception:
                pass

        def load_catalog_image(pet: dict[str, Any]) -> Image.Image:
            response = requests.get(pet["image"], headers=REMOTE_IMAGE_HEADERS, timeout=20)
            response.raise_for_status()
            return Image.open(io.BytesIO(response.content)).convert("RGB")

        with ThreadPoolExecutor(max_workers=min(8, len(CATALOG))) as executor:
            gallery_images = list(executor.map(load_catalog_image, CATALOG))

        embeddings: list[np.ndarray] = []
        batch_size = 8
        for start in range(0, len(gallery_images), batch_size):
            embeddings.append(self.dino_embedding(gallery_images[start:start + batch_size]))

        self.dino_gallery_embeddings = np.concatenate(embeddings, axis=0)
        DINO_GALLERY_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        np.save(DINO_GALLERY_CACHE_PATH, self.dino_gallery_embeddings)

    def rank_dino(self, query_embedding: np.ndarray, top_k: int) -> list[dict[str, Any]]:
        self.ensure_dino_gallery_index()
        scores = query_embedding @ self.dino_gallery_embeddings.T
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

    def segment_pet_crops(
        self,
        image: Image.Image,
        detections: list[dict[str, Any]],
    ) -> tuple[list[Image.Image], list[dict[str, Any]]]:
        if not detections or any(detection.get("fallback") for detection in detections):
            crops = [self._crop_with_padding(image, detection["box"]) for detection in detections]
            metadata = [
                {
                    "status": "fallback_crop",
                    "model": None,
                    "iou_score": None,
                    "mask_area_ratio": None,
                }
                for _ in detections
            ]
            return crops, metadata

        self.load_segmenter()
        boxes = [[float(value) for value in detection["box"]] for detection in detections]
        inputs = self.segmenter_processor(
            images=image,
            input_boxes=[boxes],
            return_tensors="pt",
        )
        model_inputs = {
            key: value.to(DEVICE) if hasattr(value, "to") else value
            for key, value in inputs.items()
        }
        with torch.inference_mode():
            outputs = self.segmenter_model(**model_inputs, multimask_output=False)

        masks = self.segmenter_processor.post_process_masks(
            outputs.pred_masks,
            inputs["original_sizes"],
        )[0]
        iou_scores = outputs.iou_scores.detach().cpu().reshape(-1).tolist()
        crops: list[Image.Image] = []
        metadata: list[dict[str, Any]] = []

        for index, detection in enumerate(detections):
            mask_tensor = masks[index][0].detach().cpu()
            mask_array = mask_tensor.numpy().astype(np.uint8) * 255
            mask_image = Image.fromarray(mask_array, mode="L")
            neutral_background = Image.new("RGB", image.size, (244, 244, 244))
            segmented = Image.composite(image, neutral_background, mask_image)
            crop = self._crop_with_padding(segmented, detection["box"])
            crop_mask = self._crop_with_padding(mask_image.convert("RGB"), detection["box"]).convert("L")
            mask_ratio = float(np.asarray(crop_mask, dtype=np.uint8).mean() / 255.0)
            crops.append(crop)
            metadata.append(
                {
                    "status": "segmented",
                    "model": SEGMENTATION_MODEL,
                    "iou_score": float(iou_scores[index]) if index < len(iou_scores) else None,
                    "mask_area_ratio": mask_ratio,
                }
            )

        return crops, metadata

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

    @staticmethod
    def assess_open_set(
        predictions: list[dict[str, Any]],
        matches: list[dict[str, Any]],
    ) -> dict[str, Any]:
        top1 = float(predictions[0]["confidence"]) if predictions else 0.0
        top2 = float(predictions[1]["confidence"]) if len(predictions) > 1 else 0.0
        margin = max(0.0, top1 - top2)
        retrieval_score = float(matches[0]["score"]) if matches else None
        low_top1 = top1 < UNKNOWN_TOP1_THRESHOLD
        low_margin = margin < UNKNOWN_MARGIN_THRESHOLD
        uncertain = low_top1 or (top1 < 0.72 and low_margin)
        reasons: list[str] = []
        if low_top1:
            reasons.append("low_vit_top1_confidence")
        if low_margin:
            reasons.append("small_vit_top1_top2_margin")
        return {
            "status": "uncertain_out_of_set" if uncertain else "supported_candidate",
            "is_uncertain": uncertain,
            "vit_top1_confidence": top1,
            "vit_top1_top2_margin": margin,
            "clip_top1_similarity": retrieval_score,
            "thresholds": {
                "top1_confidence": UNKNOWN_TOP1_THRESHOLD,
                "top1_top2_margin": UNKNOWN_MARGIN_THRESHOLD,
            },
            "reasons": reasons,
            "note": (
                "Baseline heuristic only; this is not a calibrated open-set probability."
            ),
        }


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
        "segmentation_enabled": SEGMENTATION_ENABLED,
        "segmentation_model": SEGMENTATION_MODEL,
        "segmentation_ready": runtime.segmenter_model is not None,
        "segmentation_error": runtime.segmenter_error,
        "unknown_baseline": {
            "top1_threshold": UNKNOWN_TOP1_THRESHOLD,
            "margin_threshold": UNKNOWN_MARGIN_THRESHOLD,
        },
        "dino_model": DINO_MODEL,
        "dino_ready": runtime.dino_model is not None,
        "dino_error": runtime.dino_error,
        "dino_gallery_index_ready": runtime.dino_gallery_embeddings is not None,
        "dino_gallery_cache_ready": DINO_GALLERY_CACHE_PATH.exists(),
        "siglip2_model": SIGLIP2_MODEL,
        "siglip2_ready": runtime.siglip2_model is not None,
        "siglip2_error": runtime.siglip2_error,
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


@app.post("/compare/retrieval")
async def compare_retrieval(
    file: UploadFile = File(...),
    top_k: int = Query(default=12, ge=1, le=37),
) -> dict[str, Any]:
    image = await read_image(file)
    try:
        detections = runtime.detect_pets(image, max_pets=1)
    except Exception:
        detections = []

    if detections:
        try:
            subjects, segmentation_meta = runtime.segment_pet_crops(image, detections[:1])
            subject = subjects[0]
            subject_mode = "detected_segmented_pet"
            segmentation = segmentation_meta[0]
        except Exception:
            subject = runtime._crop_with_padding(image, detections[0]["box"])
            subject_mode = "detected_box_crop"
            segmentation = None
    else:
        subject = image
        subject_mode = "full_image"
        segmentation = None

    try:
        clip_query = runtime.image_embedding([subject])
        dino_query = runtime.dino_embedding([subject])
        clip_results = runtime.rank(clip_query, top_k)
        dino_results = runtime.rank_dino(dino_query, top_k)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Retrieval comparison unavailable: {exc}") from exc

    return {
        "subject_mode": subject_mode,
        "segmentation": segmentation,
        "clip": {"model": CLIP_MODEL_NAME, "results": clip_results},
        "dino": {"model": DINO_MODEL, "results": dino_results},
    }


@app.post("/open-set/siglip2")
async def open_set_siglip2(
    file: UploadFile = File(...),
    top_k: int = Query(default=5, ge=1, le=12),
) -> dict[str, Any]:
    image = await read_image(file)
    try:
        detections = runtime.detect_pets(image, max_pets=1)
    except Exception:
        detections = []

    if detections:
        detected_species = detections[0].get("species")
        try:
            subjects, segmentation_meta = runtime.segment_pet_crops(image, detections[:1])
            subject = subjects[0]
            subject_mode = "detected_segmented_pet"
            segmentation = segmentation_meta[0]
        except Exception:
            subject = runtime._crop_with_padding(image, detections[0]["box"])
            subject_mode = "detected_box_crop"
            segmentation = None
    else:
        detected_species = None
        subject = image
        subject_mode = "full_image"
        segmentation = None

    try:
        vit_predictions = runtime.classify(subject)
        siglip_results = runtime.siglip2_zero_shot(
            subject,
            top_k=top_k,
            species=detected_species,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"SigLIP2 open-set comparison unavailable: {exc}") from exc

    vit_top = vit_predictions[0] if vit_predictions else None
    siglip_top = siglip_results[0] if siglip_results else None
    same_top1 = bool(
        vit_top
        and siglip_top
        and str(vit_top["label"]).strip().lower().replace(" ", "_") == siglip_top["id"].lower()
    )
    return {
        "subject_mode": subject_mode,
        "detected_species": detected_species,
        "segmentation": segmentation,
        "vit": {"model": VIT_MODEL, "predictions": vit_predictions},
        "siglip2": {"model": SIGLIP2_MODEL, "results": siglip_results},
        "agreement": {
            "same_top1": same_top1,
            "vit_top1": vit_top,
            "siglip2_top1": siglip_top,
            "note": "This is a zero-shot comparison, not a calibrated unknown-breed probability.",
        },
    }


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

    segmentation_status = "disabled"
    segmentation_error = None
    if SEGMENTATION_ENABLED and not any(detection.get("fallback") for detection in detections):
        try:
            crops, segmentation_by_pet = runtime.segment_pet_crops(image, detections)
            segmentation_status = "segmented"
        except Exception as exc:
            segmentation_status = "segmenter_unavailable_fallback"
            segmentation_error = str(exc)
            crops = [runtime._crop_with_padding(image, detection["box"]) for detection in detections]
            segmentation_by_pet = [
                {
                    "status": "box_crop_fallback",
                    "model": None,
                    "iou_score": None,
                    "mask_area_ratio": None,
                }
                for _ in detections
            ]
    elif any(detection.get("fallback") for detection in detections):
        crops, segmentation_by_pet = runtime.segment_pet_crops(image, detections)
        segmentation_status = "fallback_crop"
    else:
        crops = [runtime._crop_with_padding(image, detection["box"]) for detection in detections]
        segmentation_by_pet = [
            {
                "status": "disabled_box_crop",
                "model": None,
                "iou_score": None,
                "mask_area_ratio": None,
            }
            for _ in detections
        ]

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
        open_set = runtime.assess_open_set(
            predictions_by_pet[index],
            matches_by_pet[index],
        )
        pets.append(
            {
                "id": f"pet-{index + 1}",
                "species": detection["species"],
                "detector_score": detection.get("score"),
                "fallback": bool(detection.get("fallback", False)),
                "box": runtime._box_payload(detection["box"], width, height),
                "segmentation": segmentation_by_pet[index],
                "open_set": open_set,
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
        "segmentation": {
            "status": segmentation_status,
            "enabled": SEGMENTATION_ENABLED,
            "model": SEGMENTATION_MODEL if SEGMENTATION_ENABLED else None,
            "error": segmentation_error,
        },
        "detected_pet_count": detected_pet_count,
        "analysis_subject_count": len(pets),
        "primary_pet_id": primary_pet["id"],
        "pets": pets,
        "open_set": primary_pet["open_set"],
        "predictions": primary_pet["predictions"],
        "results": primary_pet["results"],
        "models": {
            "detector": DETECTOR_MODEL,
            "segmenter": SEGMENTATION_MODEL if SEGMENTATION_ENABLED else None,
            "classifier": VIT_MODEL,
            "retrieval": CLIP_MODEL_NAME,
        },
    }
