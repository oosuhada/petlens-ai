from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from datasets import load_dataset
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from torchvision.transforms import (
    CenterCrop,
    ColorJitter,
    Compose,
    Normalize,
    RandomHorizontalFlip,
    RandomResizedCrop,
    Resize,
    ToTensor,
)
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    Trainer,
    TrainingArguments,
    set_seed,
)


DATASET_NAME = "giacomov/tsinghua_dogs"
DEFAULT_BACKBONE = "google/vit-base-patch16-224"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fine-tune ViT on the 130-class Tsinghua Dogs dataset.")
    parser.add_argument("--output-dir", default="/content/petlens-dog130-vit")
    parser.add_argument("--backbone", default=DEFAULT_BACKBONE)
    parser.add_argument("--epochs", type=float, default=3.0)
    parser.add_argument("--train-batch-size", type=int, default=32)
    parser.add_argument("--eval-batch-size", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--weight-decay", type=float, default=0.01)
    parser.add_argument("--warmup-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--num-workers", type=int, default=4)
    return parser.parse_args()


def clean_label_name(raw_name: str) -> str:
    parts = raw_name.split("-", 2)
    breed = parts[2] if len(parts) == 3 else raw_name
    return breed.replace("_", " ").strip()


def build_transforms(processor: AutoImageProcessor) -> tuple[Compose, Compose]:
    size_config = processor.size
    if "height" in size_config and "width" in size_config:
        image_size = min(int(size_config["height"]), int(size_config["width"]))
    else:
        image_size = int(size_config.get("shortest_edge", 224))

    mean = processor.image_mean
    std = processor.image_std
    train_transform = Compose(
        [
            RandomResizedCrop(image_size, scale=(0.72, 1.0)),
            RandomHorizontalFlip(p=0.5),
            ColorJitter(brightness=0.15, contrast=0.15, saturation=0.12),
            ToTensor(),
            Normalize(mean=mean, std=std),
        ]
    )
    eval_transform = Compose(
        [
            Resize(image_size + 32),
            CenterCrop(image_size),
            ToTensor(),
            Normalize(mean=mean, std=std),
        ]
    )
    return train_transform, eval_transform


def main() -> None:
    args = parse_args()
    set_seed(args.seed)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    dataset = load_dataset(DATASET_NAME)
    label_feature = dataset["train"].features["label"]
    raw_label_names = list(label_feature.names)
    label_names = [clean_label_name(name) for name in raw_label_names]
    id2label = {index: label for index, label in enumerate(label_names)}
    label2id = {label: index for index, label in id2label.items()}

    processor = AutoImageProcessor.from_pretrained(args.backbone)
    train_transform, eval_transform = build_transforms(processor)

    def transform_train(batch: dict) -> dict:
        batch["pixel_values"] = [train_transform(image.convert("RGB")) for image in batch["image"]]
        return batch

    def transform_eval(batch: dict) -> dict:
        batch["pixel_values"] = [eval_transform(image.convert("RGB")) for image in batch["image"]]
        return batch

    train_dataset = dataset["train"].with_transform(transform_train)
    eval_dataset = dataset["validation"].with_transform(transform_eval)

    model = AutoModelForImageClassification.from_pretrained(
        args.backbone,
        num_labels=len(label_names),
        id2label=id2label,
        label2id=label2id,
        ignore_mismatched_sizes=True,
    )

    def collate_fn(examples: list[dict]) -> dict[str, torch.Tensor]:
        return {
            "pixel_values": torch.stack([example["pixel_values"] for example in examples]),
            "labels": torch.tensor([example["label"] for example in examples], dtype=torch.long),
        }

    def compute_metrics(eval_prediction) -> dict[str, float]:
        logits, labels = eval_prediction
        predictions = np.argmax(logits, axis=-1)
        return {
            "accuracy": float(accuracy_score(labels, predictions)),
            "macro_precision": float(precision_score(labels, predictions, average="macro", zero_division=0)),
            "macro_recall": float(recall_score(labels, predictions, average="macro", zero_division=0)),
            "macro_f1": float(f1_score(labels, predictions, average="macro", zero_division=0)),
        }

    bf16 = bool(torch.cuda.is_available() and torch.cuda.is_bf16_supported())
    fp16 = bool(torch.cuda.is_available() and not bf16)
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.train_batch_size,
        per_device_eval_batch_size=args.eval_batch_size,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        warmup_ratio=args.warmup_ratio,
        eval_strategy="epoch",
        save_strategy="epoch",
        logging_strategy="steps",
        logging_steps=50,
        load_best_model_at_end=True,
        metric_for_best_model="macro_f1",
        greater_is_better=True,
        save_total_limit=2,
        remove_unused_columns=False,
        dataloader_num_workers=args.num_workers,
        bf16=bf16,
        fp16=fp16,
        report_to=[],
        seed=args.seed,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=collate_fn,
        compute_metrics=compute_metrics,
        processing_class=processor,
    )
    trainer.train()
    metrics = trainer.evaluate()
    trainer.save_model(str(output_dir))
    processor.save_pretrained(str(output_dir))

    metadata = {
        "dataset": DATASET_NAME,
        "backbone": args.backbone,
        "num_labels": len(label_names),
        "train_examples": len(dataset["train"]),
        "validation_examples": len(dataset["validation"]),
        "label_names": label_names,
        "metrics": {key: float(value) for key, value in metrics.items() if isinstance(value, (int, float))},
        "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu",
        "torch_version": torch.__version__,
    }
    (output_dir / "petlens_training_summary.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
