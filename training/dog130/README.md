# PetLens Dog-130 GPU Training

PetLens 2.0의 130개 개 품종 분류기를 만드는 GPU 전용 학습 단계입니다.

## Dataset

- Hugging Face dataset: `giacomov/tsinghua_dogs`
- 130 dog breeds
- train: 65,228 images
- validation: 5,200 images
- mirror license metadata: CC BY 4.0
- original dataset: Tsinghua Dogs

## Training output contract

학습이 끝나면 `--output-dir` 아래에 Hugging Face `AutoModelForImageClassification`로 바로 로드 가능한 checkpoint가 생성되어야 합니다.

필수 파일은 다음과 같습니다.

- `config.json`
- `model.safetensors` 또는 equivalent model weight file
- image processor config files
- `petlens_training_summary.json`

`petlens_training_summary.json`에는 최소한 다음 정보가 기록됩니다.

- dataset / backbone
- 130 label names
- train / validation example count
- validation accuracy
- macro precision / recall / F1
- 실제 GPU 이름
- PyTorch version

## Recommended Colab command

```bash
pip install -q "transformers>=4.57,<5" "datasets>=3,<5" "accelerate>=1,<2" "scikit-learn>=1.5,<2" "torchvision>=0.22"
python training/dog130/train_dog130.py \
  --output-dir /content/drive/MyDrive/PetLens/dog130-vit \
  --epochs 3 \
  --train-batch-size 32 \
  --eval-batch-size 64
```

OOM이 발생하면 train batch를 `16`, eval batch를 `32`로 낮추고 다시 실행합니다.

## Production integration

학습 artifact를 Mac mini에 복사한 후 API 환경 변수로 다음 경로를 지정하는 구조를 사용합니다.

```bash
PETLENS_DOG130_MODEL=/Users/gabrieljang/sites/petlens-ai/models/dog130-vit
```

PetLens API는 기존 Oxford-IIIT 37-class 모델을 고양이 및 legacy reference 모델로 유지하고, detector가 `dog`를 반환했을 때 Dog-130 classifier를 우선 사용하는 hierarchical 구조로 확장합니다.

## Completed training run

2026-08-27 Colab A100 실행 결과:

- GPU: `NVIDIA A100-SXM4-40GB`
- train examples: `65,228`
- validation examples: `5,200`
- epochs: `3`
- train / eval batch size: `32 / 64`
- validation accuracy: `0.8678846154`
- macro precision: `0.8812951476`
- macro recall: `0.8678846154`
- macro F1: `0.8663649887`
- label count: `130`
- artifact zip size: `2,221,390,831 bytes`

Colab artifact paths:

```text
/content/drive/MyDrive/PetLens/dog130-vit
/content/drive/MyDrive/PetLens/dog130-vit/petlens_training_summary.json
/content/drive/MyDrive/PetLens/petlens-dog130-vit.zip
```
