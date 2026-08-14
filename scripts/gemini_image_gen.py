#!/usr/bin/env python3
"""Generate or condition images with Gemini image models."""

from __future__ import annotations

import argparse
import base64
import mimetypes
import os
import sys
from pathlib import Path
from typing import Any

MODEL_ALIASES = {
    "nano-banana": "gemini-2.5-flash-image",
    "nano-banana-2": "gemini-3.1-flash-image-preview",
    "nano-banana-pro": "gemini-3-pro-image-preview",
}
DEFAULT_MODEL = MODEL_ALIASES["nano-banana"]
DEFAULT_OUTPUT = "output/imagegen/gemini/generated"


def _die(message: str, code: int = 1) -> None:
    print(f"Error: {message}", file=sys.stderr)
    raise SystemExit(code)


def _get_api_key() -> str:
    _load_env_file()
    return os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""


def _resolve_model(raw: str) -> str:
    return MODEL_ALIASES.get(raw, raw)


def _load_env_file() -> None:
    env_path = Path(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key and key not in os.environ:
            os.environ[key] = value


def _load_sdk() -> tuple[Any, Any]:
    try:
        from google import genai
        from google.genai import types
    except ImportError as exc:
        print(
            "Error: google-genai is not installed. Run `python3 -m pip install --user google-genai`.",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc

    return genai, types


def _detect_mime(path: Path) -> str:
    mime_type, _ = mimetypes.guess_type(path.name)
    if not mime_type or not mime_type.startswith("image/"):
        _die(f"Could not infer an image MIME type for {path}. Use png, jpg, jpeg or webp.")
    return mime_type


def _read_image_part(path: Path, types_module: Any) -> Any:
    if not path.exists():
        _die(f"Image not found: {path}")
    mime_type = _detect_mime(path)
    return types_module.Part.from_bytes(data=path.read_bytes(), mime_type=mime_type)


def _guess_extension(mime_type: str) -> str:
    ext = mimetypes.guess_extension(mime_type) or ".png"
    return ".jpg" if ext == ".jpe" else ext


def _build_output_paths(base: Path, count: int, extension: str) -> list[Path]:
    if count == 1:
        if base.suffix:
            return [base]
        return [base.with_suffix(extension)]

    if base.suffix:
        base = base.with_suffix("")

    return [base.parent / f"{base.name}-{idx}{extension}" for idx in range(1, count + 1)]


def _write_images(base: Path, outputs: list[tuple[bytes | str, str]]) -> list[Path]:
    if not outputs:
        _die("Gemini returned no image output.")

    extension = _guess_extension(outputs[0][1])
    paths = _build_output_paths(base, len(outputs), extension)

    for path in paths:
        path.parent.mkdir(parents=True, exist_ok=True)

    for path, (payload, _) in zip(paths, outputs):
        if isinstance(payload, str):
            data = base64.b64decode(payload)
        else:
            data = payload
        path.write_bytes(data)

    return paths


def _response_parts(response: Any) -> list[Any]:
    parts = list(getattr(response, "parts", None) or [])
    if parts:
        return parts

    candidates = getattr(response, "candidates", None) or []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        if content and getattr(content, "parts", None):
            parts.extend(content.parts)
    return parts


def _parse_outputs(response: Any) -> tuple[list[tuple[bytes | str, str]], list[str]]:
    image_outputs: list[tuple[bytes | str, str]] = []
    text_outputs: list[str] = []

    for part in _response_parts(response):
        inline_data = getattr(part, "inline_data", None)
        if inline_data and getattr(inline_data, "data", None):
            image_outputs.append((inline_data.data, inline_data.mime_type or "image/png"))

        text = getattr(part, "text", None)
        if text:
            text_outputs.append(text)

    return image_outputs, text_outputs


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate or edit images with Gemini / Nano Banana models."
    )
    parser.add_argument(
        "--prompt",
        required=False,
        help="Text instruction for image generation or editing.",
    )
    parser.add_argument(
        "--image",
        action="append",
        default=[],
        help="Optional input image path. Repeat to send multiple images.",
    )
    parser.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=(
            "Gemini model or alias. Aliases: "
            + ", ".join(f"{alias}={model}" for alias, model in MODEL_ALIASES.items())
        ),
    )
    parser.add_argument(
        "--out",
        default=DEFAULT_OUTPUT,
        help="Output file or file prefix. Default: output/imagegen/gemini/generated",
    )
    parser.add_argument(
        "--aspect-ratio",
        default=None,
        help="Optional Gemini image aspect ratio such as 1:1, 9:16 or 16:9.",
    )
    parser.add_argument(
        "--list-models",
        action="store_true",
        help="Print the Nano Banana aliases and exit.",
    )
    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    if args.list_models:
        for alias, model in MODEL_ALIASES.items():
            print(f"{alias} -> {model}")
        return

    if not args.prompt:
        _die("Missing --prompt.")

    api_key = _get_api_key()
    if not api_key:
        _die("GEMINI_API_KEY or GOOGLE_API_KEY is not set.")

    genai, types_module = _load_sdk()
    model = _resolve_model(args.model)
    contents: list[Any] = [types_module.Part.from_text(text=args.prompt)]
    contents.extend(_read_image_part(Path(raw), types_module) for raw in args.image)

    client = genai.Client(api_key=api_key)
    config_kwargs: dict[str, Any] = {"response_modalities": ["IMAGE"]}
    if args.aspect_ratio:
        config_kwargs["image_config"] = types_module.ImageConfig(
            aspect_ratio=args.aspect_ratio
        )

    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=types_module.GenerateContentConfig(**config_kwargs),
        )
    except Exception as exc:
        message = str(exc)
        if "429" in message and "RESOURCE_EXHAUSTED" in message:
            _die(
                "Gemini image quota unavailable for this key. Enable billing for the Google AI project "
                "or use another key with image generation quota."
            )
        raise

    image_outputs, text_outputs = _parse_outputs(response)
    written_paths = _write_images(Path(args.out), image_outputs)

    for path in written_paths:
        print(path)

    for text in text_outputs:
        print(text, file=sys.stderr)


if __name__ == "__main__":
    main()
