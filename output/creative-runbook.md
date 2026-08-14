# Media Generation Runbook

## Image prompts

- `output/imagegen/axe-benefits-residence.prompt.txt`
- `output/imagegen/axe-career-strategy-room.prompt.txt`
- `output/imagegen/axe-plans-structured-capital.prompt.txt`

## Video prompt

- `output/sora/axe-hero-loop.prompt.txt`

## Commands

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export IMAGE_GEN="$CODEX_HOME/skills/imagegen/scripts/image_gen.py"
export SORA_CLI="$CODEX_HOME/skills/sora/scripts/sora.py"
```

```bash
uv run --with openai --with pillow python3 "$IMAGE_GEN" generate \
  --prompt-file output/imagegen/axe-benefits-residence.prompt.txt \
  --no-augment \
  --size 1536x1024 \
  --quality high \
  --output-format webp \
  --out public/media/axe-benefits-residence.webp
```

```bash
uv run --with openai --with pillow python3 "$IMAGE_GEN" generate \
  --prompt-file output/imagegen/axe-career-strategy-room.prompt.txt \
  --no-augment \
  --size 1536x1024 \
  --quality high \
  --output-format webp \
  --out public/media/axe-career-strategy-room.webp
```

```bash
uv run --with openai --with pillow python3 "$IMAGE_GEN" generate \
  --prompt-file output/imagegen/axe-plans-structured-capital.prompt.txt \
  --no-augment \
  --size 1536x1024 \
  --quality high \
  --output-format webp \
  --out public/media/axe-plans-structured-capital.webp
```

```bash
uv run --with openai python3 "$SORA_CLI" create-and-poll \
  --prompt-file output/sora/axe-hero-loop.prompt.txt \
  --no-augment \
  --model sora-2-pro \
  --size 1280x720 \
  --seconds 8 \
  --download \
  --variant video \
  --out public/media/axe-hero-loop.mp4
```

```bash
uv run --with openai python3 "$SORA_CLI" download \
  --id <video_id> \
  --variant thumbnail \
  --out public/media/axe-hero-loop-poster.webp
```
