"""Cut out and rotate the original Little Ser scan from a local Sonch knightbook.

python tools/import-little-ser-token.py --source-pdf ".../Sonch.pdf" --page 5 --crop 63.5 224.5 118 282.5 --dpi 600
Requires PyMuPDF and Pillow. Only removes exterior paper and rotates the source
pixels; never generates, redraws, recolors or sharpens the artwork.
"""
import argparse
from collections import deque
import hashlib
import json
from pathlib import Path

import fitz
from PIL import Image, PngImagePlugin


def remove_exterior_paper(source):
    """Flood only the paper outside the red rim, preserving the cream face."""
    rgb = source.convert('RGB')
    width, height = rgb.size
    pixels = list(rgb.getdata())
    # The red rim is a barrier; black and cream artwork inside it stays opaque.
    rim = bytearray(r >= 65 and r - g >= 20 and r - b >= 13 for r, g, b in pixels)
    exterior = bytearray(width * height)
    pending = deque()

    def visit(index):
        if not rim[index] and not exterior[index]:
            exterior[index] = 1
            pending.append(index)

    for x in range(width):
        visit(x)
        visit((height - 1) * width + x)
    for y in range(height):
        visit(y * width)
        visit(y * width + width - 1)
    while pending:
        index = pending.popleft()
        x, y = index % width, index // width
        if x:
            visit(index - 1)
        if x + 1 < width:
            visit(index + 1)
        if y:
            visit(index - width)
        if y + 1 < height:
            visit(index + width)
    alpha = Image.frombytes('L', rgb.size, bytes(0 if outside else 255 for outside in exterior))
    result = rgb.convert('RGBA')
    result.putalpha(alpha)
    if not alpha.getbbox():
        raise ValueError('Could not identify the original red Little Ser rim')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--save', type=Path)
    parser.add_argument('--source-pdf', type=Path)
    parser.add_argument('--page', type=int, help='One-based PDF page')
    parser.add_argument('--crop', type=float, nargs=4, metavar=('LEFT', 'TOP', 'RIGHT', 'BOTTOM'))
    parser.add_argument('--dpi', type=int, default=288)
    parser.add_argument('--pdf-cache', type=Path)
    parser.add_argument('--public', type=Path, default=Path(__file__).resolve().parents[1] / 'public')
    args = parser.parse_args()
    target = args.public / 'assets/tokens/little-ser.png'
    if args.source_pdf:
        if not args.page or not args.crop:
            parser.error('--source-pdf requires --page and --crop')
        source_pdf = args.source_pdf
    elif args.save:
        save = json.loads(args.save.read_text(encoding='utf-8-sig'))
        book = next(obj for obj in save['ObjectStates'] if obj.get('GUID') == 'c9a307')
        digest = book['CustomPDF']['PDFUrl'].rstrip('/').split('/')[-1]
        cache = args.pdf_cache or args.save.parent.parent / 'PDF'
        matches = [path for path in cache.iterdir() if digest.lower() in path.name.lower()]
        if len(matches) != 1:
            raise ValueError(f'Expected one cached Sonch knightbook: {matches}')
        source_pdf = matches[0]
    else:
        parser.error('Pass --source-pdf or --save')
    target.parent.mkdir(parents=True, exist_ok=True)
    page_number = args.page or 4
    with fitz.open(source_pdf) as document:
        # Printed p.4 (PDF p.4), illustration explicitly captioned "Little Ser token".
        clip = fitz.Rect(args.crop or [101, 374, 201, 470])
        if not document[page_number - 1].rect.contains(clip):
            raise ValueError('Little Ser crop falls outside the Sonch rules page')
        pixmap = document[page_number - 1].get_pixmap(dpi=args.dpi, clip=clip, alpha=False)
        source = Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)
    cutout = remove_exterior_paper(source)
    # A rigid 45-degree counterclockwise rotation levels the original face.
    rotated = cutout.rotate(45, resample=Image.Resampling.BICUBIC, expand=True)
    cropped = rotated.crop(rotated.getchannel('A').getbbox())
    side = max(cropped.size) + 24
    result = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    result.paste(cropped, ((side - cropped.width) // 2, (side - cropped.height) // 2))
    provenance = PngImagePlugin.PngInfo()
    provenance.add_text('Source', f'{source_pdf.name}, printed p.4 / PDF p.{page_number}')
    provenance.add_text('CropPdfPoints', json.dumps(list(clip)))
    provenance.add_text('RenderedDPI', str(args.dpi))
    provenance.add_text('SourceCropSHA256', hashlib.sha256(source.tobytes()).hexdigest())
    provenance.add_text('Operations', 'Exterior-paper alpha mask; rigid CCW 45-degree rotation; crop and transparent padding. No redraw.')
    result.save(target, pnginfo=provenance)
    print(f'Prepared original Little Ser scan without redrawing: {target}')


if __name__ == '__main__':
    main()
