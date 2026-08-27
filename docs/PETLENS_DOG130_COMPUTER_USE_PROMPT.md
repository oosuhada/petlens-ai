# Local GPT Computer Use Prompt — PetLens Dog-130 GPU Training

아래 프롬프트를 로컬 GPT 앱의 Computer Use 세션에 그대로 전달한다.

---

PetLens 2.0의 130개 개 품종 ViT classifier를 Google Colab GPU에서 학습해줘.

로컬 GitHub 작업 저장소는 다음이다.

`/Users/gabrieljang/Documents/Macbook air personal/git-timeline-rewrite-workspace/repos/petlens-ai`

GitHub repository:

`https://github.com/oosuhada/petlens-ai`

현재 `main`에는 GPU에서 실행할 학습 스크립트가 이미 준비되어 있다.

`training/dog130/train_dog130.py`

학습 데이터는 Hugging Face의 다음 공개 dataset mirror를 사용한다.

`giacomov/tsinghua_dogs`

이 데이터는 130 dog breeds, train 65,228 images, validation 5,200 images로 구성되어 있다.

해야 할 일:

1. Chrome에서 Google Colab을 열고 GPU runtime을 연결한다.
2. 가능하면 A100을 사용하고, 없다면 L4 또는 T4를 사용한다.
3. runtime GPU 이름을 반드시 출력해서 기록한다.
4. Colab에서 GitHub `oosuhada/petlens-ai`의 최신 `main`을 clone한다.
5. Google Drive를 mount한다.
6. 아래 dependency를 설치한다.

   `transformers>=4.57,<5`
   `datasets>=3,<5`
   `accelerate>=1,<2`
   `scikit-learn>=1.5,<2`
   `torchvision>=0.22`

7. 다음 명령으로 학습한다.

   `python training/dog130/train_dog130.py --output-dir /content/drive/MyDrive/PetLens/dog130-vit --epochs 3 --train-batch-size 32 --eval-batch-size 64`

8. CUDA OOM이면 train batch 16 / eval batch 32로 낮춰 다시 실행한다. epoch 수나 dataset을 줄여서 임의로 빠르게 끝내지 말 것.
9. 학습 중 가장 좋은 `macro_f1` checkpoint를 최종 모델로 저장한다.
10. 학습 완료 후 `/content/drive/MyDrive/PetLens/dog130-vit/petlens_training_summary.json`을 열어 다음 값을 보고한다.

   - GPU
   - validation accuracy
   - macro precision
   - macro recall
   - macro F1
   - label count가 정확히 130인지

11. 최종 checkpoint 폴더에 `config.json`, model weight, processor config, `petlens_training_summary.json`이 모두 있는지 확인한다.
12. 결과 폴더를 zip으로도 만든다.

   `/content/drive/MyDrive/PetLens/petlens-dog130-vit.zip`

13. 학습 코드는 임의로 변경하지 말고, 오류가 있을 때만 최소 수정한다. 수정이 필요했다면 어떤 줄을 왜 바꿨는지 보고한다.
14. GitHub에는 대용량 model weight를 commit/push하지 않는다.
15. 학습이 끝나면 모델 artifact의 Google Drive 경로와 metrics만 보고하고 종료한다. 아직 Mac mini production에는 배포하지 않는다.

중요:

- GPU 종류가 성능을 올리는 변수라고 주장하지 말고 학습 실행 환경으로만 기록한다.
- validation metric을 임의로 만들거나 추정하지 않는다.
- 중간 notebook 출력이 아니라 실제 `petlens_training_summary.json` 값을 최종 결과로 사용한다.
- Dataset이나 pretrained model을 임의로 다른 것으로 교체하지 않는다.
- Google Drive/Hugging Face/GitHub 비밀번호나 token을 채팅에 출력하지 않는다.

---
