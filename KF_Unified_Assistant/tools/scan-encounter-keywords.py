"""OCR the currently displayed encounter faces; requires Tesseract and source images."""
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('boss_scanner', ROOT / 'tools/scan-boss-keywords.py')
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)
records = json.loads((ROOT / 'tools/encounter-keyword-manifest.json').read_text(encoding='utf-8'))
dictionary = json.loads((ROOT / 'public/keyword-data/keywords.json').read_text(encoding='utf-8'))['entries']
tesseract = os.environ.get('TESSERACT', r'C:\Program Files\Tesseract-OCR\tesseract.exe')

def scan(item):
    image = ROOT / 'public' / item['path'].lstrip('/')
    if not image.is_file():
        return item['id'], None
    env = dict(os.environ, OMP_THREAD_LIMIT='1')
    process = subprocess.run([tesseract, str(image), 'stdout', '-l', 'chi_sim+eng', '--psm', '11'], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
    return item['id'], process.stdout.decode('utf-8', errors='replace') if process.returncode == 0 else None

ocr_path = ROOT / 'tools/encounter-keyword-ocr.json'
if '--match-only' in sys.argv:
    ocr = json.loads(ocr_path.read_text(encoding='utf-8'))
else:
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        ocr = dict(pool.map(scan, records))
expected = {item['id'] for item in records}
if len(expected) != len(records) or set(ocr) != expected:
    raise SystemExit('OCR data does not match encounter manifest')
missing = [key for key, value in ocr.items() if value is None]
if missing:
    raise SystemExit('Missing or unreadable images: ' + ', '.join(missing))
ocr_path.write_text(json.dumps(ocr, ensure_ascii=False), encoding='utf-8')
cards = {key: scanner.match_keywords(value, dictionary) for key, value in ocr.items()}
reviewed = set()
valid = {entry['id'] for entry in dictionary}
for path in sorted((ROOT / 'tools').glob('encounter-keyword-reviews-*.json')):
    for key, words in json.loads(path.read_text(encoding='utf-8'))['cards'].items():
        if key not in cards or key in reviewed or not isinstance(words, list) or any(word not in valid for word in words):
            raise ValueError(f'Invalid or duplicate review: {key}')
        reviewed.add(key)
        cards[key] = list(dict.fromkeys(words))
(ROOT / 'public/keyword-data/encounter-keywords.json').write_text(json.dumps({'source':'Encounter card faces; automatic OCR and manual review', 'cards':cards, 'reviewed':sorted(reviewed)}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'Scanned {len(cards)} encounter faces')
