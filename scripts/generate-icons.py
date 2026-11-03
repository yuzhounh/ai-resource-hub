"""Regenerate favicon.ico (16/32/48 px) from favicon.svg.

Usage (from the repository root):

    python -X utf8 scripts/generate-icons.py            # write favicon.ico
    python -X utf8 scripts/generate-icons.py --check     # only report renderer + coverage

The renderer is chosen at runtime, in order of preference:

1. cairosvg  (highest fidelity: gradients, CSS classes and media queries)
2. Pillow's built-in SVG support, when the installed build ships it
3. PyMuPDF (fitz), rendering the SVG through a PDF document
4. Pillow + svglib/reportlab (convert to PDF, then rasterise with fitz)

`prefers-color-scheme: dark` can never be honoured by a raster icon, so the
light-mode stroke opacity is what gets baked into favicon.ico. The SVG keeps
both styles for browsers that support them.

The script only writes favicon.ico. It exits non-zero when no renderer is
available so a stale icon is never silently shipped.
"""
from __future__ import annotations

import io
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / 'favicon.svg'
ICO = ROOT / 'favicon.ico'
SIZES = (16, 32, 48)
SHAPES = ('hub', 'node-mint', 'node-ocean', 'node-amber', 'link')
FILL_KEYS = ('favHub', 'favMint', 'favOcean', 'favAmber')
STROKE_KEYS = ('stroke:#668dd8',)
FILL_TOLERANCE = 18  # per-channel, keeps anti-aliased edges of matching shapes
STROKE_TOLERANCE = 40


def load_svg_text() -> str:
    return SVG.read_text('utf-8')


def declared_viewbox(text: str) -> tuple[float, float, float, float]:
    match = re.search(r'viewBox="([^"]+)"', text)
    if not match:
        raise SystemExit('favicon.svg has no viewBox')
    values = [float(value) for value in match.group(1).replace(',', ' ').split()]
    if len(values) != 4:
        raise SystemExit(f'unexpected viewBox: {match.group(1)}')
    return tuple(values)  # type: ignore[return-value]


def render(text: str, size: int):
    """Return a Pillow RGBA image at `size` x `size`, or raise RuntimeError."""
    import shutil, subprocess, tempfile
    inkscape = shutil.which('inkscape')
    if inkscape:
        from PIL import Image
        with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False, encoding='utf-8') as f_in:
            f_in.write(text)
            in_name = f_in.name
        out_name = in_name + '.png'
        try:
            subprocess.run([inkscape, in_name, f'--export-width={size}', f'--export-height={size}', f'--export-filename={out_name}'], check=True, capture_output=True)
            with Image.open(out_name) as im:
                return im.convert('RGBA').copy()
        finally:
            Path(in_name).unlink(missing_ok=True)
            Path(out_name).unlink(missing_ok=True)
    try:
        import cairosvg  # type: ignore
    except Exception:
        cairosvg = None
    if cairosvg is not None:
        from PIL import Image

        png = cairosvg.svg2png(
            bytestring=text.encode('utf-8'),
            output_width=size,
            output_height=size,
        )
        return Image.open(io.BytesIO(png)).convert('RGBA')

    from PIL import Image

    try:
        from PIL import features  # type: ignore

        if not features.check('svg'):
            raise ImportError('Pillow SVG support is off')
        raster = Image.open(io.BytesIO(text.encode('utf-8')))
        return raster.convert('RGBA').resize((size, size), Image.LANCZOS)
    except Exception:
        pass

    try:
        import fitz  # type: ignore
    except Exception:
        fitz = None
    if fitz is not None:
        document = fitz.open(stream=text.encode('utf-8'), filetype='svg')
        page = document[0]
        zoom = size / max(page.rect.width, page.rect.height)
        pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=True)
        return Image.open(io.BytesIO(pixmap.tobytes('png'))).convert('RGBA')

    try:
        from svglib.svglib import svg2rlg  # type: ignore
        from reportlab.graphics import renderPDF  # type: ignore
        import fitz  # type: ignore
    except Exception as exc:  # pragma: no cover - environment dependent
        raise RuntimeError('no SVG renderer available') from exc
    drawing = svg2rlg(io.StringIO(text))
    scale = size / max(drawing.width, drawing.height)
    drawing.scale(scale, scale)
    drawing.width *= scale
    drawing.height *= scale
    buffer = io.BytesIO()
    renderPDF.drawToFile(drawing, buffer)
    document = fitz.open(stream=buffer.getvalue(), filetype='pdf')
    pixmap = document[0].get_pixmap(alpha=True)
    return Image.open(io.BytesIO(pixmap.tobytes('png'))).convert('RGBA')


def paint_colors(text: str) -> tuple[list[tuple[int, int, int]], tuple[int, int, int]]:
    """Resolve the fill and stroke colours the artwork actually uses."""
    fills: list[tuple[int, int, int]] = []
    for key in FILL_KEYS:
        match = re.search(r'id="' + re.escape(key) + r'"[\s\S]*?<stop stop-color="#([0-9a-fA-F]{6})"/>[\s\S]*?<stop offset="1" stop-color="#([0-9a-fA-F]{6})"/>', text)
        if not match:
            raise SystemExit(f'gradient not found: {key}')
        for hex_value in match.groups():
            fills.append(tuple(int(hex_value[i:i + 2], 16) for i in (0, 2, 4)))
    stroke_match = re.search(r'\.link\{stroke:#([0-9a-fA-F]{6})', text)
    if not stroke_match:
        raise SystemExit('link stroke colour not found')
    hex_value = stroke_match.group(1)
    stroke = tuple(int(hex_value[i:i + 2], 16) for i in (0, 2, 4))
    return fills, stroke  # type: ignore[return-value]


def bbox(image, fills, stroke) -> tuple[int, int, int, int] | None:
    width, height = image.size
    pixels = image.load()
    left = top = width
    right = bottom = -1
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if alpha <= 24:
                continue
            opaque = alpha / 255
            tints = [(red, green, blue)]
            hits = any(
                all(abs(channel / opaque - target) <= FILL_TOLERANCE for channel, target in zip(rgb, colour))
                for rgb in tints
                for colour in fills
            )
            if not hits:
                hits = all(abs(channel / opaque - target) <= STROKE_TOLERANCE for channel, target in zip((red, green, blue), stroke))
            if hits:
                left = min(left, x)
                right = max(right, x)
                top = min(top, y)
                bottom = max(bottom, y)
    if right < 0:
        return None
    return left, top, right, bottom


def square_crop(image):
    """Pad the raster to a square so the icon never renders stretched."""
    width, height = image.size
    if width == height:
        return image
    side = max(width, height)
    canvas = image.resize((side, side))
    return canvas


def coverage_report(text: str) -> list[str]:
    fills, stroke = paint_colors(text)
    lines = []
    for size in SIZES:
        frame = render(text, size)
        box = bbox(frame, fills, stroke)
        if not box:
            lines.append(f'{size}x{size}: no artwork pixels found')
            continue
        left, top, right, bottom = box
        span_x = (right - left + 1) / size * 100
        span_y = (bottom - top + 1) / size * 100
        pad_left = left / size * 100
        pad_right = (size - 1 - right) / size * 100
        pad_top = top / size * 100
        pad_bottom = (size - 1 - bottom) / size * 100
        lines.append(
            f'{size}x{size}: artwork {span_x:.1f}% x {span_y:.1f}%, '
            f'padding L{pad_left:.1f} R{pad_right:.1f} T{pad_top:.1f} B{pad_bottom:.1f}'
        )
    return lines


def main(argv: list[str]) -> int:
    text = load_svg_text()
    view_x, view_y, view_w, view_h = declared_viewbox(text)
    print(f'viewBox {view_x:g} {view_y:g} {view_w:g} {view_h:g}')
    try:
        frames = [render(text, size) for size in SIZES]
        report = coverage_report(text)
    except RuntimeError as exc:
        print(f'{exc}: install cairosvg (pip install cairosvg) or PyMuPDF', file=sys.stderr)
        return 1
    squares = [square_crop(frame) for frame in frames]
    for line in report:
        print(line)
    if '--check' in argv:
        return 0
    squares[-1].save(ICO, format='ICO', sizes=[(size, size) for size in SIZES], append_images=squares[:-1])
    print(f'wrote {ICO.relative_to(ROOT)}: {" ".join(f"{size}x{size}" for size in SIZES)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
