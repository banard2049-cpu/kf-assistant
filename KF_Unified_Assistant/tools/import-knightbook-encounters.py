"""Import special encounter card crops from a locally owned TTS save/PDF cache.

python tools/import-knightbook-encounters.py --save ".../(Don)KF 1.8.json" --source-dir ".../FileRecv"
Requires PyMuPDF and Pillow. No network access or Lua execution.
"""
import argparse
import json
from pathlib import Path

import fitz
from PIL import Image, ImageDraw, PngImagePlugin


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--save', type=Path, required=True)
    parser.add_argument('--pdf-cache', type=Path)
    parser.add_argument('--source-dir', type=Path, help='Folder containing the verified high-resolution scans')
    parser.add_argument('--public', type=Path, default=Path(__file__).resolve().parents[1] / 'public')
    args = parser.parse_args()
    public = args.public
    cache = args.pdf_cache or args.save.parent.parent / 'PDF'
    save = json.loads(args.save.read_text(encoding='utf-8-sig'))
    objects = {obj['GUID']: obj for obj in save['ObjectStates']}
    data_path = public / 'modules/encounter/data/encounter-data.js'
    data = json.loads(data_path.read_text(encoding='utf-8').split('=', 1)[1].strip().rstrip(';'))
    ordinary = [m for m in data['monsters'] if m.get('category') != 'special']
    by_id = {m['id']: m for m in ordinary}
    boss_app = (public / 'modules/aibp/app.js').read_text(encoding='utf-8')
    boss_rows = json.loads('[' + boss_app.split('const TOKEN_ASSETS = [', 1)[1].split('].map', 1)[0] + ']')
    boss_tokens = {row[0]: {'id': row[0], 'name': row[1], 'src': f'/assets/tokens/{row[2]}'} for row in boss_rows}
    specs = json.loads((data_path.parent / 'special-encounters.json').read_text(encoding='utf-8'))['cards']
    for spec in specs:
        scan = spec.get('highResolutionSource')
        if scan and (not args.source_dir or not (args.source_dir / scan['fileName']).is_file()):
            parser.error(f"Pass --source-dir containing {scan['fileName']} to preserve the high-resolution card")
    assets = public / 'assets/cards/special-encounters'
    assets.mkdir(parents=True, exist_ok=True)
    additions = []

    def cached_pdf(source):
        if source.get('fileName'):
            return None, args.source_dir / source['fileName']
        url = objects[source['bookGuid']]['CustomPDF']['PDFUrl']
        digest = url.rstrip('/').split('/')[-1]
        matches = [p for p in cache.iterdir() if digest.lower() in p.name.lower()]
        if len(matches) != 1:
            raise ValueError(f"Expected one cached PDF for {source['bookGuid']}: {matches}")
        return url, matches[0]

    def render_crop(source, filename):
        url, pdf_path = cached_pdf(source)
        with fitz.open(pdf_path) as document:
            page = document[source['pdfPage'] - 1]
            clip = fitz.Rect(source['cropPdfPoints'])
            if not page.rect.contains(clip):
                raise ValueError(f"Crop outside source page: {filename}")
            dpi = source.get('dpi', 216)
            pix = page.get_pixmap(dpi=dpi, clip=clip, alpha=False)
            provenance = PngImagePlugin.PngInfo()
            provenance.add_text('Source', source.get('fileName') or url)
            provenance.add_text('PDFPage', str(source['pdfPage']))
            provenance.add_text('CropPdfPoints', json.dumps(source['cropPdfPoints']))
            provenance.add_text('RenderedDPI', str(dpi))
            result = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
            radius_ratio = source.get('cornerRadiusRatio', 0)
            if radius_ratio:
                # A regular rounded rectangle; never trace the scan's pixel edge.
                scale = 3
                mask = Image.new('L', (pix.width * scale, pix.height * scale))
                ImageDraw.Draw(mask).rounded_rectangle(
                    (0, 0, mask.width - 1, mask.height - 1),
                    radius=round(pix.width * radius_ratio * scale), fill=255)
                mask = mask.resize(result.size, Image.Resampling.LANCZOS)
                result = result.convert('RGBA')
                result.putalpha(mask)
                provenance.add_text('CornerMask', f'Regular rounded rectangle; radius {radius_ratio} of width')
            result.save(assets / filename, pnginfo=provenance, dpi=(dpi, dpi))
            return url, pix.width / pix.height

    for spec in specs:
        source = spec.get('highResolutionSource') or spec['source']
        card_file = f"{spec['code'].lower()}{'-hd' if spec.get('highResolutionSource') else ''}.png"
        url, card_aspect = render_crop(source, card_file)
        image_path = f"/assets/cards/special-encounters/{card_file}"
        if source.get('imageVersion'):
            image_path += f"?v={source['imageVersion']}"
        base = by_id.get(spec['baseMonsterId'])
        if spec['baseMonsterId'] and not base:
            raise ValueError(f"Unknown base monster: {spec['baseMonsterId']}")
        metadata = {key: spec[key] for key in ('code', 'knightId', 'baseMonsterId', 'usesGenericToken', 'source', 'note')}
        for key in ('countRange', 'solo'):
            if key in spec:
                metadata[key] = spec[key]
        metadata['source'] = {**source, **({'pdfUrl': url} if url else {})}
        if spec.get('highResolutionSource'):
            original_url, _ = cached_pdf(spec['source'])
            metadata['ttsSource'] = {**spec['source'], 'pdfUrl': original_url}
        token_asset = boss_tokens[spec.get('tokenAssetId', 'token-01')] if not base else None
        avatar = base['avatar'] if base else token_asset['src']
        if token_asset:
            metadata['tokenAsset'] = token_asset
        if spec.get('avatarSource'):
            avatar_source = spec['avatarSource']
            avatar_file = f"{spec['code'].lower()}-avatar.png"
            avatar_url, _ = render_crop(avatar_source, avatar_file)
            metadata['avatarSource'] = {**avatar_source, **({'pdfUrl': avatar_url} if avatar_url else {})}
            avatar = f"/assets/cards/special-encounters/{avatar_file}"
            if avatar_source.get('imageVersion'):
                avatar += f"?v={avatar_source['imageVersion']}"
        count = spec['monsterCount']
        level = {
            'level': 1, 'tier': spec['tier'], 'name': spec['name'],
            'cardId': f"Knightbook:{spec['code']}", 'side': 'face',
            'attackPattern': spec['attackPattern'], 'attackPatternVerified': True,
            'attackFacing': spec['attackFacing'],
            'image': {'face': image_path, 'width': 1, 'height': 1, 'index': 0, 'aspect': card_aspect},
            'stats': {'monsterCount': count, 'monsterSize': spec['monsterSize'], 'hit': spec['hit'],
                      'success': 'X' if spec['code'] == 'K1' else 5 if spec['code'] == 'P5' else 1 if spec['code'] in ('K4', 'U1') else 2,
                      'partial': 2 if spec['code'] == 'P5' else None if spec['code'] in ('K1', 'K4', 'U1') else 1},
        }
        if source.get('cornerRadiusRatio'):
            level['image']['cornerRadiusRatio'] = source['cornerRadiusRatio']
        if spec.get('colorCorrection'):
            level['image']['colorCorrection'] = spec['colorCorrection']
        additions.append({
            'id': f"Special_{spec['code']}", 'name': spec['name'], 'nameZh': spec['nameZh'],
            'type': 'mob' if spec['tier'] == 'mob' else 'boss', 'category': 'special',
            'special': metadata,
            'avatar': avatar,
            'encounterLevels': [level],
        })
    data['version'] = max(7, data.get('version', 0))
    data['monsters'] = ordinary + additions
    data_path.write_text('window.KF_ENCOUNTER_DATA=' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f"Imported {len(additions)} special encounter cards and their verified attack patterns.")


if __name__ == '__main__':
    main()
