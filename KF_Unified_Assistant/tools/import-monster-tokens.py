"""Crop circular monster portraits using the original tokens' framing.

Run with --apply to update the shared map and encounter token references.
Requires Pillow. Artwork is sampled from the original panels without sharpening,
denoising, or redrawing. The interface draws a red border separately at 11.2%
of the avatar diameter, capped at 11px on boards and 6px in compact previews;
portrait files contain no frame or direction symbols.
"""

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps, PngImagePlugin


# Each transform maps the 768px portrait to the panel pixels. It aligns the
# original token's inner illustration, excluding its old frame and facing mark.
CROPS = json.loads(Path(__file__).with_name('monster-token-crops.json').read_text(encoding='utf-8'))
REVISION = 'portrait-v2'


def assigned_json(path):
    return json.loads(path.read_text(encoding='utf-8-sig').split('=', 1)[1].strip().rstrip(';'))


def circular_portrait(source, spec):
    if spec['mirror']:
        source = ImageOps.mirror(source)
    size = 768
    scale = 3
    large = size * scale
    a, b, c, d, e, f = spec['affine']
    token = source.transform((large, large), Image.Transform.AFFINE,
                             (a / scale, b / scale, c, d / scale, e / scale, f),
                             resample=Image.Resampling.BICUBIC).convert('RGBA')
    alpha = Image.new('L', (large, large))
    ImageDraw.Draw(alpha).ellipse((0, 0, large - 1, large - 1), fill=255)
    token.putalpha(alpha)
    return token.resize((size, size), Image.Resampling.LANCZOS)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--public', type=Path, default=Path(__file__).resolve().parents[1] / 'public')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'output/monster-token-crops')
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    public = args.public
    monsters = assigned_json(public / 'modules/aibp/data/monster-data.js')['monsters']
    if {monster['id'] for monster in monsters} != set(CROPS):
        raise ValueError('Crop configuration must cover every monster exactly once')
    map_path = public / 'modules/map/data/map-data.js'
    encounter_path = public / 'modules/encounter/data/encounter-data.js'
    old_tokens = assigned_json(map_path)['tokens']['monsters']
    destination = public / 'assets/tokens'
    args.output.mkdir(parents=True, exist_ok=True)
    report = []
    changes = {}
    changed_monsters = [monster for monster in monsters if old_tokens[monster['id']] !=
                        f'/assets/tokens/{"boss" if monster["type"] == "boss" else "monsters"}/{CROPS[monster["id"]]["slug"]}-{REVISION}.png']
    preview = Image.new('RGB', (1040, 230 * max(1, (len(changed_monsters) + 1) // 2)), '#292725')
    preview_draw = ImageDraw.Draw(preview)
    gallery = Image.new('RGB', (1040, 230 * ((len(monsters) + 4) // 5)), '#292725')
    gallery_draw = ImageDraw.Draw(gallery)
    comparison_index = 0
    for index, monster in enumerate(monsters):
        spec = CROPS[monster['id']]
        slug = spec['slug']
        source_path = public / monster['sheet']['face'].lstrip('/')
        with Image.open(source_path) as source:
            if source.size != (2405, 1649):
                raise ValueError(f'Unexpected panel size for {monster["id"]}: {source.size}')
            token = circular_portrait(source.convert('RGB'), spec)
        metadata = PngImagePlugin.PngInfo()
        metadata.add_text('Source', monster['sheet']['face'])
        metadata.add_text('SourceSHA256', hashlib.sha256(source_path.read_bytes()).hexdigest())
        metadata.add_text('CropTransform', json.dumps(spec['affine']))
        metadata.add_text('Reference', spec['reference'])
        metadata.add_text('Operations', f'Original token framing; horizontal mirror={spec["mirror"]}; circular alpha mask. No frame, direction symbol, or artwork redraw.')
        directory = 'boss' if monster['type'] == 'boss' else 'monsters'
        target = destination / directory / f'{slug}-{REVISION}.png'
        target.parent.mkdir(parents=True, exist_ok=True)
        token.save(target, pnginfo=metadata, optimize=True)
        new_path = f'/assets/tokens/{directory}/{slug}-{REVISION}.png'
        changes[old_tokens[monster['id']]] = new_path
        report.append({'id': monster['id'], 'source': monster['sheet']['face'],
                       'reference': spec['reference'], 'affine': spec['affine'],
                       'mirror': spec['mirror'], 'token': new_path})
        gx, gy = index % 5 * 208, index // 5 * 230
        gallery_draw.ellipse((gx + 12, gy + 6, gx + 195, gy + 189), fill='#a53c36')
        thumb = token.resize((140, 140), Image.Resampling.LANCZOS)
        gallery.paste(thumb, (gx + 34, gy + 28), thumb)
        gallery_draw.text((gx + 8, gy + 198), monster['name'], fill='#eee5d3')
        if old_tokens[monster['id']] == new_path:
            continue
        col, row = comparison_index % 2, comparison_index // 2
        comparison_index += 1
        ox, oy = col * 520, row * 230
        preview_draw.text((ox + 8, oy + 5), monster['name'], fill='#eee5d3')
        old_path = public / spec['reference'].lstrip('/')
        if old_path.exists():
            with Image.open(old_path) as old:
                old = old.convert('RGBA').resize((196, 196), Image.Resampling.LANCZOS)
                preview.paste(old, (ox + 10, oy + 25), old)
        preview_draw.ellipse((ox + 256, oy + 25, ox + 451, oy + 220), fill='#a53c36')
        thumb = token.resize((152, 152), Image.Resampling.LANCZOS)
        preview.paste(thumb, (ox + 278, oy + 47), thumb)
        preview_draw.text((ox + 216, oy + 115), '->', fill='#c9b78e')
    if comparison_index:
        preview.save(args.output / 'before-after.jpg', quality=94)
    gallery.save(args.output / 'all-monsters.jpg', quality=94)
    (args.output / 'crop-manifest.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    if args.apply:
        for path in [map_path, encounter_path]:
            original = path.read_text(encoding='utf-8-sig')
            updated = original
            for old_path, new_path in changes.items():
                updated = updated.replace(json.dumps(old_path), json.dumps(new_path))
            if updated != original:
                with path.open('w', encoding='utf-8', newline='\n') as output:
                    output.write(updated)
    print(f'Prepared {len(report)} monster tokens ({len(changed_monsters)} new references); references updated={args.apply}.')


if __name__ == '__main__':
    main()
