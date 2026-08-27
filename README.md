# PetLens 2

**사진과 영상에서 반려동물을 감지하고, 개체별 품종·유사 이미지·포즈·행동을 분석하는 멀티모달 Pet Vision 서비스**

- Live: https://petlens.oosu.dev/
- Guide: https://petlens.oosu.dev/guide
- GitHub: https://github.com/oosuhada/petlens-ai

PetLens는 한 장의 사진을 단일 품종 classifier에 넣는 데서 끝나지 않습니다. 먼저 사진이나 영상 속 고양이와 강아지를 찾고, 여러 마리가 있으면 개체를 분리한 뒤 각 pet에 맞는 모델을 실행합니다. 강아지는 130개 품종 classifier, 고양이는 Pet-37 classifier를 사용하며, CLIP 검색·SAM2 segmentation/tracking·ViTPose++ pose estimation·zero-shot action timeline을 하나의 웹 흐름으로 연결합니다.

---

## Core capabilities

| Capability | What PetLens does |
| --- | --- |
| Pet detection | Grounding DINO로 복잡한 장면에서 dog / cat 위치 탐지 |
| Multi-pet analysis | 한 이미지의 여러 반려동물을 개체별로 분리해 독립 분석 |
| Segmentation | SAM2로 detection box 안의 실제 pet foreground 분리 |
| Dog breed classification | Tsinghua Dogs 기반 ViT로 **130개 강아지 품종** Top-5 예측 |
| Cat breed classification | Oxford-IIIT Pet 기반 Pet-37 classifier로 고양이 Top-5 예측 |
| Unknown warning | confidence와 top-1/top-2 margin을 이용한 보수적 open-set warning |
| Semantic search | 자연어 → CLIP embedding → 37개 reference gallery 재정렬 |
| Similar-image retrieval | 업로드 pet crop → CLIP image embedding → 유사 reference 검색 |
| Retrieval comparison | CLIP과 DINOv2 feature space의 검색 결과 비교 |
| Zero-shot comparison | SigLIP2로 별도 zero-shot 품종 후보 비교 |
| Animal pose | ViTPose++ AP-10K expert로 17-keypoint pose estimation |
| Video tracking | SAM2 Video로 영상 속 개체를 frame 간 추적 |
| Action timeline | CLIP 장면 의미 + tracking motion을 결합해 시간대별 행동 후보 생성 |

---

## Image analysis pipeline

`POST /analyze`는 사진 한 장에 대해 detection부터 retrieval까지 한 번에 수행합니다.

```text
Uploaded image
      │
      ▼
Grounding DINO
dog / cat detection
      │
      ├────────────── multiple pets ──────────────┐
      │                                            │
      ▼                                            ▼
   Pet crop                                     Pet crop
      │                                            │
      ▼                                            ▼
SAM2 segmentation                           SAM2 segmentation
      │                                            │
      ▼                                            ▼
 species routing                               species routing
      │                                            │
      ├── dog ──► Dog-130 ViT                  ...
      └── cat ──► Pet-37 ViT
      │
      ├──► Top-5 breed predictions
      ├──► open-set warning
      └──► CLIP image retrieval
```

### Hierarchical classifier routing

PetLens는 detector가 판단한 species에 따라 classifier를 분기합니다.

```text
dog  → Dog-130 ViT → 130 dog breeds
cat  → Pet-37 ViT  → Oxford-IIIT Pet label space
```

Dog-130 checkpoint가 설정되지 않았거나 로딩에 실패하면 API는 Pet-37 classifier로 fallback하고, 응답의 `classifier.scope`에 해당 상태를 표시합니다.

### Multi-pet UX

여러 마리가 감지되면 원본 이미지 위에 pet box를 표시합니다. 사용자는 box나 개체 카드를 선택해 해당 pet의 다음 결과를 바로 전환할 수 있습니다.

- detection confidence
- segmentation 결과
- classifier scope (`dog130`, `pet37`, fallback)
- Top-5 breed predictions
- unknown warning
- CLIP similarity ranking
- optional SigLIP2 / DINOv2 / pose analysis

---

## Video analysis pipeline

PetLens는 짧은 업로드 영상을 batch 방식으로 분석합니다. 기본 설정은 최대 12개 frame을 샘플링합니다.

```text
Uploaded video
      │
      ▼
Frame sampling
      │
      ▼
Grounding DINO on first frame
      │
      ▼
SAM2 Video tracking
      │
      ├── Track 1 ──► Dog-130 / Pet-37
      ├── Track 2 ──► Dog-130 / Pet-37
      └── ...
      │
      ├──► representative-frame breed aggregation
      ├──► CLIP retrieval aggregation
      ├──► geometric motion descriptor
      └──► semantic action timeline
```

각 track은 영상 전체에서 동일한 반려동물을 따라가며 다음 정보를 반환합니다.

- species
- tracked frame count
- breed Top-5 aggregation
- classifier scope
- similar reference images
- motion: `mostly_stationary`, `moving`, `high_motion`
- action timeline

현재 Mac mini production은 CPU serving이므로 실시간 스트리밍 분석이 아니라 **짧은 영상 업로드 후 결과를 기다리는 batch UX**를 사용합니다.

---

## Semantic action timeline

Action timeline은 별도의 supervised action classifier를 새로 학습한 결과가 아닙니다. 각 SAM2 track을 여러 시간 구간으로 나누고, 해당 구간의 pet crop에 대한 **CLIP zero-shot 의미 점수**와 **tracking 이동량**을 함께 사용합니다.

현재 action label set:

```text
standing
sitting
lying_down
sleeping
walking
running
jumping
eating
drinking
playing
grooming
```

예시 응답 개념:

```text
TRACK 1 · DOG
Chihuahua 89.7%

Motion · High motion

00:00–00:01  Running
00:01–00:02  Running
00:02–00:03  Running
```

행동을 과하게 확정하지 않도록 다음 기준을 사용합니다.

- minimum zero-shot score: `0.18`
- minimum top-1 / top-2 margin: `0.012`
- 기준 미달: `unknown`

따라서 action score는 calibrated probability가 아닙니다. 장면 의미와 motion prior를 결합한 **zero-shot 상대 점수**이며, 애매한 구간은 행동을 강제로 지정하지 않습니다.

---

## Search and retrieval

### Text → Image

영문 자연어를 CLIP text embedding으로 변환하고 37개 Oxford-IIIT Pet reference embedding과 cosine similarity를 계산합니다.

```text
"a small white fluffy dog"
        │
        ▼
CLIP text encoder
        │
        ▼
37 reference embeddings
        │
        ▼
semantic ranking
```

CLIP score는 품종 확률이 아니라 embedding similarity입니다.

### Image → Image

분석된 pet crop을 CLIP image encoder에 넣고 같은 37개 reference gallery를 시각적 유사도 순으로 재정렬합니다.

Dog-130이 130개 품종을 분류하더라도 **reference gallery 자체는 37개 Oxford-IIIT Pet 이미지**로 유지됩니다. 따라서 breed classification label space와 retrieval gallery space는 서로 독립적입니다.

### DINOv2 comparison

`POST /compare/retrieval`은 같은 이미지에 대해 CLIP과 DINOv2의 retrieval ranking을 함께 반환합니다. 두 모델이 어떤 visual feature를 우선하는지 비교하는 실험용 기능입니다.

### SigLIP2 comparison

`POST /open-set/siglip2`는 기존 classifier 결과와 SigLIP2 zero-shot 후보를 비교합니다. 두 모델의 불일치는 오답 확정이 아니라 ambiguity / open-set 탐색 신호로 사용합니다.

---

## Animal pose

`POST /pose`는 Grounding DINO가 찾은 pet box를 ViTPose++의 AP-10K expert에 전달합니다.

주요 keypoint:

- nose
- left / right eye
- left / right ear
- shoulders
- elbows
- wrists
- hips
- knees
- ankles

웹 UI에서는 keypoint를 원본 이미지 위에 overlay해 표시합니다.

---

## Model stack

| Role | Model / method | Runtime behavior |
| --- | --- | --- |
| Detection | `IDEA-Research/grounding-dino-tiny` | lazy load |
| Segmentation | `facebook/sam2-hiera-tiny` | detection 후 lazy load |
| Video tracking | `facebook/sam2-hiera-tiny` / SAM2 Video | video 요청 시 lazy load |
| Dog classifier | custom `google/vit-base-patch16-224` fine-tune | 130-class local checkpoint |
| Cat classifier | `rakib730/vit-base-oxford-iiit-pets` by default | Pet-37 branch / fallback |
| Production retrieval | `openai/clip-vit-base-patch32` | gallery embedding cache 사용 |
| SigLIP2 comparison | `google/siglip2-base-patch16-224` | 요청할 때만 load |
| DINOv2 comparison | `facebook/dinov2-small` | 요청할 때만 load |
| Pose | `usyd-community/vitpose-plus-base` | AP-10K expert |
| Action | CLIP zero-shot + SAM2 tracking motion | 별도 action weight 없음 |

모델 이름은 대부분 환경변수로 교체할 수 있습니다.

---

## Dog-130 training

Dog branch는 `google/vit-base-patch16-224`를 `giacomov/tsinghua_dogs` 데이터셋의 130개 label에 fine-tuning한 checkpoint를 사용합니다.

### Training setup

| Item | Value |
| --- | --- |
| Dataset | Tsinghua Dogs (`giacomov/tsinghua_dogs`) |
| Classes | **130** |
| Train images | **65,228** |
| Validation images | **5,200** |
| Backbone | `google/vit-base-patch16-224` |
| Epochs | **3** |
| Train batch size | **32** |
| Eval batch size | **64** |
| GPU | **NVIDIA A100-SXM4-40GB** |

### Validation metrics

| Metric | Result |
| --- | ---: |
| Accuracy | **0.8678846154** |
| Macro Precision | **0.8812951476** |
| Macro Recall | **0.8678846154** |
| Macro F1 | **0.8663649887** |

Training script:

```text
training/dog130/train_dog130.py
```

최종 production artifact는 Hugging Face `AutoImageProcessor`와 `AutoModelForImageClassification`에서 바로 로드할 수 있는 형태입니다.

```text
config.json
model.safetensors
preprocessor_config.json
petlens_training_summary.json
```

Model weight는 Git repository에 포함하지 않습니다.

---

## Open-set warning

Closed-set classifier는 입력이 label set 밖이어도 반드시 기존 클래스 중 하나를 선택합니다. PetLens는 이를 그대로 확정적으로 표시하지 않기 위해 간단한 warning layer를 둡니다.

현재 baseline:

- top-1 confidence threshold: `0.55`
- top-1 / top-2 margin threshold: `0.12`

낮은 confidence 또는 작은 margin이 감지되면 `uncertain_out_of_set` 경고를 반환합니다.

이 값은 **unknown breed probability가 아닙니다.** calibration된 OOD detector가 아니라 사용자에게 결과를 후보로 해석하라는 보수적 UX signal입니다.

---

## API

FastAPI ML service의 주요 endpoint입니다.

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | device, model lazy-load 상태, cache 상태 확인 |
| `POST /analyze` | detection → segmentation → species routing → classification → CLIP retrieval |
| `POST /analyze/video` | frame sampling → SAM2 tracking → breed aggregation → action timeline |
| `POST /classify` | Pet-37 단일 이미지 Top-5 classifier endpoint |
| `POST /search/text` | 자연어 → CLIP gallery ranking |
| `POST /search/image` | 이미지 → CLIP gallery ranking |
| `POST /open-set/siglip2` | ViT / SigLIP2 zero-shot 비교 |
| `POST /compare/retrieval` | CLIP / DINOv2 image retrieval 비교 |
| `POST /pose` | detection → ViTPose++ animal keypoints |

`/analyze`가 PetLens 2의 기본 이미지 분석 endpoint입니다. Dog-130 hierarchical routing은 `/analyze`와 `/analyze/video`에서 적용됩니다.

---

## Web application

Frontend는 Next.js + Chakra UI로 구성되어 있습니다.

주요 화면:

- 37-reference masonry gallery
- CLIP semantic text search
- photo upload analysis drawer
- detection box / multi-pet selector
- Dog-130 / Pet-37 classifier scope badge
- SAM2 segmentation result
- SigLIP2 / DINOv2 advanced comparison
- ViTPose++ overlay
- video upload / tracking result
- per-track action timeline
- breed reference detail page
- Korean / English locale toggle
- light / dark mode

Live demo: **https://petlens.oosu.dev/**

---

## Run locally

### 1. Install dependencies

```bash
npm ci

python3 -m venv .venv
.venv/bin/pip install -r ml_service/requirements.txt
```

### 2. Configure models

Dog-130 checkpoint가 있다면 shell environment에 경로를 지정합니다.

```bash
export PETLENS_DOG130_MODEL=/absolute/path/to/dog130-vit
```

필요하면 다른 모델도 교체할 수 있습니다.

```bash
export PETLENS_VIT_MODEL=rakib730/vit-base-oxford-iiit-pets
export PETLENS_CLIP_MODEL=openai/clip-vit-base-patch32
export PETLENS_DETECTOR_MODEL=IDEA-Research/grounding-dino-tiny
export PETLENS_SEGMENTATION_MODEL=facebook/sam2-hiera-tiny
export PETLENS_VIDEO_MODEL=facebook/sam2-hiera-tiny
export PETLENS_SIGLIP2_MODEL=google/siglip2-base-patch16-224
export PETLENS_DINO_MODEL=facebook/dinov2-small
export PETLENS_POSE_MODEL=usyd-community/vitpose-plus-base
```

전체 옵션은 `.env.example`을 참고하세요.

### 3. Start web + ML service

```bash
chmod +x run_local.sh
./run_local.sh
```

- Web: `http://127.0.0.1:3000`
- FastAPI: `http://127.0.0.1:8000`

첫 분석 요청에서는 Hugging Face model download와 lazy loading 때문에 시간이 더 걸릴 수 있습니다.

현재 frontend stack은 Next.js 10 기반이므로 `run_local.sh`는 Node/OpenSSL 호환을 위해 `NODE_OPTIONS=--openssl-legacy-provider`를 적용합니다.

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_PETLENS_API_URL` | frontend가 호출할 FastAPI URL |
| `PETLENS_DEVICE` | `auto`, `cpu` 등 inference device 선택 |
| `PETLENS_VIT_MODEL` | Pet-37 classifier checkpoint |
| `PETLENS_DOG130_MODEL` | Dog-130 local checkpoint |
| `PETLENS_CLIP_MODEL` | CLIP retrieval model |
| `PETLENS_DETECTOR_MODEL` | Grounding DINO model |
| `PETLENS_SEGMENTATION_MODEL` | SAM2 image segmentation model |
| `PETLENS_SEGMENTATION_ENABLED` | SAM2 image segmentation on/off |
| `PETLENS_SIGLIP2_MODEL` | zero-shot comparison model |
| `PETLENS_DINO_MODEL` | DINOv2 retrieval comparison model |
| `PETLENS_VIDEO_MODEL` | SAM2 video tracker |
| `PETLENS_POSE_MODEL` | ViTPose++ model |
| `PETLENS_VIDEO_MAX_MB` | upload video size limit |
| `PETLENS_VIDEO_MAX_FRAMES` | maximum sampled frames |
| `PETLENS_UNKNOWN_TOP1_THRESHOLD` | open-set warning top-1 threshold |
| `PETLENS_UNKNOWN_MARGIN_THRESHOLD` | open-set warning margin threshold |
| `PETLENS_GALLERY_CACHE` | persistent CLIP gallery embedding cache |
| `PETLENS_DINO_GALLERY_CACHE` | persistent DINOv2 gallery embedding cache |

---

## Repository structure

```text
petlens-ai/
├── components/
│   ├── AnalyzeDrawer.js          # image / multi-pet / pose / comparison UI
│   ├── VideoAnalyzeDrawer.js     # tracking + action timeline UI
│   ├── ExplorerHeader.js
│   ├── PhotoStage.js
│   └── PhotoTile.js
├── data/
│   └── pets.json                 # 37-reference gallery catalog
├── hooks/
│   └── usePetLensLocale.js
├── lib/
│   ├── api.js                    # frontend ↔ FastAPI client
│   └── catalog.js
├── ml_service/
│   ├── app.py                    # complete PetLens 2 inference pipeline
│   └── requirements.txt
├── pages/
│   ├── index.js                  # gallery / search / photo / video analysis
│   ├── guide.js                  # model-result interpretation guide
│   ├── onboarding.js
│   └── photos/[id].js            # reference detail
├── scripts/
│   └── deploy-dog130-model.sh    # local Dog-130 artifact → production deploy
├── training/
│   └── dog130/
│       ├── train_dog130.py
│       └── README.md
├── .env.example
├── run_local.sh
└── README.md
```

---

## Production

Production은 Web과 ML runtime을 분리해 실행합니다.

```text
Browser
   │
   ├── petlens.oosu.dev
   │       └── Next.js web
   │
   └── petlens-api.oosu.dev
           └── FastAPI / PyTorch inference
```

Model weight는 GitHub에 저장하지 않고 production machine의 별도 model directory에서 로드합니다. Gallery embedding은 `.npy` cache로 영구 저장해 API restart 시 재계산 비용을 줄입니다.

Production은 현재 CPU serving이므로 모델은 필요한 순간에 lazy-load하며, 특히 SAM2 video tracking과 action timeline은 짧은 영상 분석을 전제로 합니다.

---

## Limitations

PetLens의 결과를 해석할 때 다음 제한을 고려해야 합니다.

- Dog-130은 130개 학습 label 안에서만 분류합니다.
- Cat branch는 Pet-37 label space 안에서만 분류합니다.
- Unknown warning은 calibrated OOD probability가 아닙니다.
- CLIP / DINOv2 similarity score는 breed confidence가 아닙니다.
- SigLIP2 결과는 zero-shot comparison입니다.
- Action timeline은 supervised action classifier가 아니라 CLIP zero-shot + track motion 기반입니다.
- 정지·가려짐·작은 개체·빠른 camera motion이 있는 영상에서는 tracking/action 품질이 떨어질 수 있습니다.
- 현재 video analysis는 real-time stream processing이 아니라 sampled-frame batch inference입니다.

PetLens는 의료 진단이나 행동 이상 진단을 위한 시스템이 아니라 **반려동물 visual understanding과 multimodal retrieval을 탐색하기 위한 AI application**입니다.
