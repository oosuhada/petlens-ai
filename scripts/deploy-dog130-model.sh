#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 /path/to/petlens-dog130-vit.zip" >&2
  exit 2
fi

ZIP_PATH="$1"
if [[ ! -f "$ZIP_PATH" ]]; then
  echo "Artifact not found: $ZIP_PATH" >&2
  exit 2
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

unzip -q "$ZIP_PATH" -d "$TMP_DIR"

MODEL_DIR="$(find "$TMP_DIR" -type f -name config.json -print -quit | xargs -I{} dirname "{}")"
if [[ -z "${MODEL_DIR:-}" || ! -f "$MODEL_DIR/config.json" ]]; then
  echo "Could not locate Hugging Face checkpoint config.json in archive." >&2
  exit 1
fi

if [[ ! -f "$MODEL_DIR/model.safetensors" && -z "$(find "$MODEL_DIR" -maxdepth 1 -type f \( -name 'pytorch_model*.bin' -o -name 'model-*.safetensors' \) -print -quit)" ]]; then
  echo "Could not locate model weights in $MODEL_DIR" >&2
  exit 1
fi

if [[ -f "$MODEL_DIR/petlens_training_summary.json" ]]; then
  python3 - "$MODEL_DIR/petlens_training_summary.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding="utf-8"))
labels = data.get("num_labels") or len(data.get("label_names", []))
if labels != 130:
    raise SystemExit(f"Expected 130 labels, got {labels}")
print("training summary:", {
    "num_labels": labels,
    "gpu": data.get("gpu"),
    "accuracy": data.get("metrics", {}).get("eval_accuracy"),
    "macro_f1": data.get("metrics", {}).get("eval_macro_f1"),
})
PY
fi

REMOTE_ROOT="/Users/gabrieljang/sites/petlens-ai"
REMOTE_MODEL="$REMOTE_ROOT/models/dog130-vit"
REMOTE_PLIST="$HOME/Library/LaunchAgents/dev.oosu.petlens-api.plist"

ssh mac-mini "mkdir -p '$REMOTE_MODEL'"
rsync -a --delete "$MODEL_DIR/" "mac-mini:$REMOTE_MODEL/"

ssh mac-mini "/usr/libexec/PlistBuddy -c 'Delete :EnvironmentVariables:PETLENS_DOG130_MODEL' '$REMOTE_PLIST' >/dev/null 2>&1 || true; /usr/libexec/PlistBuddy -c 'Add :EnvironmentVariables:PETLENS_DOG130_MODEL string $REMOTE_MODEL' '$REMOTE_PLIST'"
ssh mac-mini 'uid=$(id -u); launchctl bootout gui/$uid "$HOME/Library/LaunchAgents/dev.oosu.petlens-api.plist" >/dev/null 2>&1 || true; launchctl bootstrap gui/$uid "$HOME/Library/LaunchAgents/dev.oosu.petlens-api.plist"; launchctl kickstart -k gui/$uid/dev.oosu.petlens-api'

echo "Waiting for API..."
for _ in $(seq 1 30); do
  if ssh mac-mini 'curl -fsS http://127.0.0.1:8121/health >/tmp/petlens-dog130-health.json'; then
    break
  fi
  sleep 2
done

ssh mac-mini 'cat /tmp/petlens-dog130-health.json'
echo
echo "Dog-130 model deployed to $REMOTE_MODEL"
