"""Extract the seven knights' portraits from verified local storybook scans.

python tools/import-knight-story-portraits.py --source-dir ".../FileRecv" --apply

Requires PyMuPDF and Pillow. Source PDFs remain unchanged. The source drawings
are cropped and resized; Ser Ubar's sideways illustration is rigidly rotated.
No text, border, color correction, sharpening, or generated artwork is added.
Display color matching is applied separately by knight-portrait-colors.js;
regenerate those filters with tools/match-knight-portrait-colors.py if needed.
"""

import argparse
import hashlib
import json
from pathlib import Path
import shutil

import fitz
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SPECS = json.loads(Path(__file__).with_name('knight-story-portrait-crops.json').read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, required=True)
    parser.add_argument('--public', type=Path, default=ROOT / 'public')
    parser.add_argument('--output', type=Path, default=ROOT / 'output/knight-story-portraits')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    # Verify every source before replacing any portrait.
    for knight, spec in SPECS.items():
        path = args.source_dir / spec['fileName']
        if not path.is_file() or digest(path) != spec['sha256']:
            raise ValueError(f'Storybook scan is missing or changed for {knight}: {path}')
    args.output.mkdir(parents=True, exist_ok=True)
    originals = args.output / 'originals'
    originals.mkdir(exist_ok=True)
    report = []
    preview = Image.new('RGB', (1400, 470), '#292725')
    draw = ImageDraw.Draw(preview)
    for index, (knight, spec) in enumerate(SPECS.items()):
        source = args.source_dir / spec['fileName']
        with fitz.open(source) as document:
            page = document[spec['pdfPage'] - 1]
            crop = fitz.Rect(spec['cropPdfPoints'])
            if not page.rect.contains(crop) or abs(crop.width - crop.height) > .01:
                raise ValueError(f'Portrait crop must be square and inside the page: {knight}')
            pixmap = page.get_pixmap(dpi=600, clip=crop, alpha=False)
            portrait = Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)
        if spec['rotationDegrees']:
            portrait = portrait.rotate(spec['rotationDegrees'], expand=True)
        portrait = portrait.resize((768, 768), Image.Resampling.LANCZOS)
        target = args.public / 'assets/heroes' / f'{knight}-avatar.jpg'
        backup = originals / target.name
        if not backup.exists():
            shutil.copyfile(target, backup)
        output = args.output / f'{knight}-story-avatar.jpg'
        portrait.save(output, quality=96, subsampling=0, dpi=(600, 600))
        if args.apply:
            shutil.copyfile(output, target)
        with Image.open(backup) as old:
            preview.paste(old.resize((188, 188), Image.Resampling.LANCZOS), (index * 200 + 6, 34))
        preview.paste(portrait.resize((188, 188), Image.Resampling.LANCZOS), (index * 200 + 6, 274))
        draw.text((index * 200 + 6, 8), knight, fill='#eee5d3')
        draw.text((index * 200 + 6, 242), f'Storybook p.{spec["printedPage"]}', fill='#eee5d3')
        report.append({'knightId': knight, **spec, 'sourcePath': str(source),
                       'asset': f'/assets/heroes/{knight}-avatar.jpg?v=story-1',
                       'size': [768, 768], 'sha256Output': digest(output),
                       'operations': '600dpi source crop; optional rigid rotation; resize. No redraw or color changes.'})
    preview.save(args.output / 'before-after.jpg', quality=94)
    (args.output / 'portrait-sources.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'Prepared {len(report)} verified storybook portraits; applied={args.apply}.')


if __name__ == '__main__':
    main()
