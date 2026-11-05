"""Extract OCR text for boss cards; generated results require manual review.

--incremental scans entries missing from the cached OCR.
--match-only regenerates matches from cached OCR and reviewed overrides.
--backup-traits supplements OCR from local pre-translation trait images, if present.
--bp-headings uses a second OCR mode to recover selected BP heading text.
The default scan requires Tesseract's eng and chi_sim models and the local images.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'tools/card-ocr-manifest.json'
OUT = ROOT / 'public/data/card-keyword-ocr.json'
MATCHES = ROOT / 'public/keyword-data/card-keywords.json'
SUPPLEMENT = ROOT / 'public/data/card-keyword-ocr-supplement.json'
BP_HEADINGS = ROOT / 'public/data/card-keyword-bp-headings.json'
TESSERACT = os.environ.get('TESSERACT', r'C:\Program Files\Tesseract-OCR\tesseract.exe')

def match_keywords(text, dictionary):
    """Match printed terms, including numeric placeholders, without nested duplicates."""
    text = unicodedata.normalize('NFKC', text or '')
    found = []
    for entry in dictionary:
        for field in ('en', 'zh'):
            word = unicodedata.normalize('NFKC', entry.get(field, '')).strip()
            if len(word) < 3 and field == 'en':
                continue
            if len(word) < 2:
                continue
            # X and Y in headwords are parameters, not literal printed text.
            pattern = ''.join(r'\s*(?:\d+|[XY])' if ch in 'XY' else
                              r'\s*' if ch.isspace() else re.escape(ch) for ch in word)
            if field == 'en':
                pattern = r'(?<![A-Za-z])' + pattern + r'(?![A-Za-z])'
            else:
                # OCR frequently inserts whitespace between Chinese characters.
                pattern = r'\s*'.join(pattern_parts(word))
            for match in re.finditer(pattern, text, re.I):
                # The ordinary instruction "discard a Hex/token/Gear" is not
                # the dictionary's standalone random-hand-discard keyword.
                if entry['id'] == 'Discard' and not re.match(r'\s*[.。!！;；:：]', text[match.end():]):
                    continue
                found.append((match.start(), match.end(), entry['id']))
    # A more specific phrase already accounts for the shorter word it contains.
    return [entry['id'] for entry in dictionary if any(
        item[2] == entry['id'] and not any(
            other[2] != item[2] and other[0] <= item[0] and other[1] >= item[1]
            and (other[0], other[1]) != (item[0], item[1]) for other in found)
        for item in found)]

def pattern_parts(word):
    return [r'(?:\d+|[XY])' if ch in 'XY' else re.escape(ch)
            for ch in word if not ch.isspace()]

def scan(item):
    path = ROOT / 'public' / item['path'].lstrip('/')
    if not path.exists():
        raise FileNotFoundError(f"Missing card image for {item['id']}: {path}")
    env = dict(os.environ, OMP_THREAD_LIMIT='1')
    lang = 'chi_sim+eng' if ':' not in item['id'] or ':Trait' in item['id'] or item.get('mergeInto') else 'eng'
    proc = subprocess.run([TESSERACT, str(path), 'stdout', '-l', lang, '--psm', '11'],
                          stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
    if proc.returncode:
        raise RuntimeError(f"OCR failed for {item['id']}")
    return item['id'], proc.stdout.decode('utf-8', errors='replace')

def main():
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if '--match-only' in sys.argv:
        results = json.loads(OUT.read_text(encoding='utf-8'))
    elif '--incremental' in sys.argv and OUT.exists():
        results = json.loads(OUT.read_text(encoding='utf-8'))
        missing = [item for item in manifest if item['id'] not in results or results[item['id']] is None]
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results.update(pool.map(scan, missing))
        OUT.write_text(json.dumps(results, ensure_ascii=False), encoding='utf-8')
    else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results = dict(pool.map(scan, manifest))
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(results, ensure_ascii=False), encoding='utf-8')
    if '--backup-traits' in sys.argv:
        backup = ROOT.parent / '.image-backups/traits-zh-replaced-20261024181241'
        candidates = [item for item in manifest if ':Trait' in item['id'] and (backup / item['path'].lstrip('/')).is_file()]
        def scan_backup(item):
            env = dict(os.environ, OMP_THREAD_LIMIT='1')
            proc = subprocess.run([TESSERACT, str(backup / item['path'].lstrip('/')), 'stdout', '-l', 'eng', '--psm', '11'],
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
            if proc.returncode:
                raise RuntimeError('Could not OCR backup for ' + item['id'])
            return item['id'], proc.stdout.decode('utf-8', errors='replace')
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            supplement = dict(pool.map(scan_backup, candidates))
        SUPPLEMENT.write_text(json.dumps(supplement, ensure_ascii=False), encoding='utf-8')
    else:
        supplement = json.loads(SUPPLEMENT.read_text(encoding='utf-8')) if SUPPLEMENT.exists() else {}
    if '--bp-headings' in sys.argv:
        bp_items = [item for item in manifest if re.search(r':BP[^:]*:', item['id'])]
        def scan_bp(item):
            env = dict(os.environ, OMP_THREAD_LIMIT='1')
            proc = subprocess.run([TESSERACT, str(ROOT / 'public' / item['path'].lstrip('/')), 'stdout', '-l', 'eng', '--psm', '6'],
                                  stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env)
            if proc.returncode:
                raise RuntimeError('Could not OCR BP for ' + item['id'])
            return item['id'], proc.stdout.decode('utf-8', errors='replace')
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            heading_ocr = dict(pool.map(scan_bp, bp_items))
        BP_HEADINGS.write_text(json.dumps(heading_ocr, ensure_ascii=False), encoding='utf-8')
    else:
        heading_ocr = json.loads(BP_HEADINGS.read_text(encoding='utf-8')) if BP_HEADINGS.exists() else {}
    dictionary = json.loads((ROOT / 'public/keyword-data/keywords.json').read_text(encoding='utf-8'))['entries']
    matches = {key: match_keywords((text or '') + '\n' + supplement.get(key, ''), dictionary) for key, text in results.items()}
    for key, value in heading_ocr.items():
        # Only trust an intact keyword followed by its printed numeric threshold.
        found = isinstance(value, str) and re.search(r'(?<![A-Za-z])P?OVERCOME\s*\d+\s*[+)]', value, re.I)
        if found and key in matches and 'OvercomeX+' not in matches[key]:
            matches[key].append('OvercomeX+')
    traits_by_monster = {}
    for item in manifest:
        if item.get('mergeInto'):
            target = item['mergeInto']
            matches[target] = list(dict.fromkeys(matches.get(target, []) + matches.get(item['id'], [])))
        if item.get('monsterId'):
            traits_by_monster.setdefault(item['monsterId'], []).append(item['id'])
    reviewed_path = ROOT / 'public/data/card-keywords-reviewed.json'
    if reviewed_path.exists():
        for key, correction in json.loads(reviewed_path.read_text(encoding='utf-8')).items():
            removed = set(correction.get('remove', []))
            matches[key] = list(dict.fromkeys([word for word in matches.get(key, []) if word not in removed]
                                             + correction.get('add', [])))
    seen_reviews = set()
    review_paths = sorted(set((ROOT / 'tools').glob('card-keyword-*-overrides.json')) |
                          set((ROOT / 'tools').glob('card-keyword-*-reviews.json')))
    for path in review_paths:
        overrides = json.loads(path.read_text(encoding='utf-8'))
        for key, correction in overrides.get('cards', {}).items():
            if key in seen_reviews:
                raise ValueError('Duplicate reviewed card: ' + key)
            seen_reviews.add(key)
            if key not in matches:
                raise ValueError('Unknown reviewed card: ' + key)
            words = correction.get('keywords')
            if words is not None:
                valid = {entry['id'] for entry in dictionary}
                if not isinstance(words, list) or any(word not in valid for word in words):
                    raise ValueError('Invalid reviewed keywords: ' + key)
                matches[key] = list(dict.fromkeys(words))
    MATCHES.write_text(json.dumps({'source': 'Card images, automatic OCR; review required', 'cards': matches,
                                   'traitsByMonster': traits_by_monster}, ensure_ascii=False), encoding='utf-8')
    print('scanned', sum(v is not None for v in results.values()), 'of', len(results))

if __name__ == '__main__':
    main()
