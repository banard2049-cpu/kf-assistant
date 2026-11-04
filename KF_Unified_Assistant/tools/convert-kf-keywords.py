"""Convert the supplied KF Eudic dictionary to public/keyword-data/keywords.json.

Usage: python tools/convert-kf-keywords.py path/to/dictionary.eudic
This converter validates the source version because its binary index is specific to
this Eudic export. It preserves both language sections and their original HTML.
"""
import hashlib
import html
import json
from pathlib import Path
import re
import struct
import sys
import zlib

EXPECTED_SHA256 = '837035ca2a5979ed624e32af7d1b1b7ba94bff69c4f46d5c388a1a1c67ed6d20'
BLOCKS = (1295, 3932, 6871, 9927, 12930, 15910)
INDEX_OFFSET, INDEX_COUNT = 18512, 292
TITLE = re.compile(r'<font size="\+2">(.*?)</font>', re.S)
HAN = re.compile(r'[\u4e00-\u9fff]')


def clean_title(value):
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip(':： ')


def convert(source):
    raw = Path(source).read_bytes()
    if hashlib.sha256(raw).hexdigest() != EXPECTED_SHA256:
        raise ValueError('Unrecognized dictionary version; binary offsets require verification')
    content = b''.join(zlib.decompress(raw[offset:]) for offset in BLOCKS)
    entries = {}
    counts = {}
    for index in range(INDEX_COUNT):
        offset, length, _ = struct.unpack_from('<QII', raw, INDEX_OFFSET + index * 16)
        definition = content[offset:offset + length].decode('utf-8')
        titles = [clean_title(title) for title in TITLE.findall(definition)]
        if len(titles) != 2 or sum(bool(HAN.search(title)) for title in titles) != 1:
            raise ValueError(f'Unexpected title layout at record {index}')
        en = next(title for title in titles if not HAN.search(title))
        zh = next(title for title in titles if HAN.search(title))
        key = (en, zh)
        counts[key] = counts.get(key, 0) + 1
        # Keep the English-first entry, whose body also includes the Chinese definition.
        if not HAN.search(titles[0]):
            entries[key] = {'id': en, 'en': en, 'zh': zh, 'definitionHtml': definition}
    if len(entries) != 146 or any(count != 2 for count in counts.values()):
        raise ValueError('Unexpected dictionary record count')
    return {'source': 'A4 KF Keyword 修订版（导入到欧路词典APP）.eudic',
            'entries': list(entries.values())}


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    output = Path(__file__).resolve().parents[1] / 'public' / 'keyword-data' / 'keywords.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(convert(sys.argv[1]), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {output}')
