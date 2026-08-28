#!/usr/bin/env python3
"""Generate the Last Minute Study iOS app icon (opaque 1024 square, no rounding)."""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 1024
BG = (15, 23, 42, 255)  # slate-900
FG = (255, 255, 255, 255)


def draw_timer(draw: ImageDraw.ImageDraw, cx: float, cy: float, r: float) -> None:
    stroke = max(18, int(r * 0.12))
    # Stopwatch crown
    crown_w = r * 0.28
    crown_h = r * 0.22
    draw.rounded_rectangle(
        [cx - crown_w / 2, cy - r - crown_h - stroke, cx + crown_w / 2, cy - r + stroke],
        radius=stroke * 0.6,
        fill=FG,
    )
    # Side buttons
    for sign in (-1, 1):
        bx = cx + sign * r * 0.72
        by = cy - r * 0.72
        draw.line([(cx + sign * r * 0.42, cy - r * 0.42), (bx, by)], fill=FG, width=stroke)
        draw.ellipse([bx - stroke, by - stroke, bx + stroke, by + stroke], fill=FG)

    draw.ellipse(
        [cx - r, cy - r, cx + r, cy + r],
        outline=FG,
        width=stroke,
    )
    # Hands
    draw.line([(cx, cy), (cx, cy - r * 0.52)], fill=FG, width=stroke)
    draw.line([(cx, cy), (cx + r * 0.38, cy + r * 0.12)], fill=FG, width=max(12, stroke - 4))
    hub = stroke * 0.7
    draw.ellipse([cx - hub, cy - hub, cx + hub, cy + hub], fill=FG)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    assets = root / "assets"
    public = root / "public"
    assets.mkdir(exist_ok=True)
    public.mkdir(exist_ok=True)

    img = Image.new("RGB", (SIZE, SIZE), BG[:3])
    draw = ImageDraw.Draw(img)
    draw_timer(draw, SIZE / 2, SIZE / 2 + 36, 280)
    icon_path = assets / "icon.png"
    img.save(icon_path, "PNG")

    splash = Image.new("RGB", (2732, 2732), BG[:3])
    sdraw = ImageDraw.Draw(splash)
    draw_timer(sdraw, 2732 / 2, 2732 / 2 + 40, 360)
    splash.save(assets / "splash.png", "PNG")

    touch = img.resize((180, 180), Image.Resampling.LANCZOS)
    touch.save(public / "apple-touch-icon.png", "PNG")
    img.resize((192, 192), Image.Resampling.LANCZOS).save(public / "icon-192.png", "PNG")
    img.resize((512, 512), Image.Resampling.LANCZOS).save(public / "icon-512.png", "PNG")
    print(f"Wrote {icon_path}")


if __name__ == "__main__":
    main()
