"""
Every uploaded image is stored as WebP.

The browser already crops to the right shape, but the API cannot trust that,
so this module is the single place that checks, crops, shrinks, and encodes an
image before it reaches storage. Metadata (EXIF, GPS, camera details) is
dropped because it is never re-encoded.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
# Refuse decompression bombs before decoding: 40 megapixels covers any phone camera.
MAX_PIXELS = 40_000_000
ACCEPTED_FORMATS = frozenset({"JPEG", "PNG", "WEBP"})
QUALITY_STEPS = (82, 72, 62, 50)


@dataclass(frozen=True)
class ImageSpec:
    """
    Output size for one kind of image. Smaller uploads are never enlarged.
    With crop=False the image keeps its own shape and only fits inside the box.
    """

    width: int
    height: int
    max_bytes: int
    crop: bool = True


# Menu and product photos: 4:3, the shape of the order screen's cards.
PRODUCT = ImageSpec(width=1200, height=900, max_bytes=250 * 1024)
# Promo banners: 2:1, wide enough to read at the top of the promo picker.
PROMO = ImageSpec(width=1200, height=600, max_bytes=250 * 1024)


class ImageRejected(ValueError):
    """The upload is not an image this app accepts. The message is safe to show."""


def _crop_to_ratio(image: Image.Image, spec: ImageSpec) -> Image.Image:
    """Centre-crop to the spec's aspect ratio, keeping as many pixels as possible."""
    target = spec.width / spec.height
    width, height = image.size
    if abs(width / height - target) < 0.01:
        return image
    if width / height > target:
        new_width = round(height * target)
        left = (width - new_width) // 2
        return image.crop((left, 0, left + new_width, height))
    new_height = round(width / target)
    top = (height - new_height) // 2
    return image.crop((0, top, width, top + new_height))


def _encode(image: Image.Image, quality: int) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="WEBP", quality=quality, method=6)
    return buffer.getvalue()


def to_webp(upload, spec: ImageSpec) -> ContentFile:
    """
    Return the upload as a WebP ContentFile with a random name.

    Raises ImageRejected when the file is too large, is not a JPG, PNG, or
    WebP image, or has more pixels than any real photo would.
    """
    size = getattr(upload, "size", None)
    if size is not None and size > MAX_UPLOAD_BYTES:
        raise ImageRejected("The image must be 10 MB or smaller.")

    try:
        upload.seek(0)
        with Image.open(upload) as probe:
            if probe.format not in ACCEPTED_FORMATS:
                raise ImageRejected("Upload a JPG, PNG, or WebP image.")
            if probe.width * probe.height > MAX_PIXELS:
                raise ImageRejected("The image has too many pixels. Use a smaller photo.")
            probe.verify()
        upload.seek(0)
        with Image.open(upload) as source:
            image = ImageOps.exif_transpose(source)
            image.load()
    except ImageRejected:
        raise
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError) as exc:
        raise ImageRejected("Upload a JPG, PNG, or WebP image.") from exc
    finally:
        upload.seek(0)

    has_alpha = image.mode in {"RGBA", "LA", "PA"} or (image.mode == "P" and "transparency" in image.info)
    image = image.convert("RGBA" if has_alpha else "RGB")
    if spec.crop:
        image = _crop_to_ratio(image, spec)
    image.thumbnail((spec.width, spec.height), Image.Resampling.LANCZOS)

    return ContentFile(_within_budget(image, spec), name=f"{uuid.uuid4().hex}.webp")


def _within_budget(image: Image.Image, spec: ImageSpec) -> bytes:
    """Lower the quality first; if that is not enough, shrink in 20% steps down to a quarter size."""
    min_width = max(spec.width // 4, 1)
    while True:
        for quality in QUALITY_STEPS:
            data = _encode(image, quality)
            if len(data) <= spec.max_bytes:
                return data
        if image.width <= min_width:
            return data
        smaller = (max(round(image.width * 0.8), min_width), max(round(image.height * 0.8), 1))
        image = image.resize(smaller, Image.Resampling.LANCZOS)
