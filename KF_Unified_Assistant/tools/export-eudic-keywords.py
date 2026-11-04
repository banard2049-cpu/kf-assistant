"""Export the completed KF dictionary using the supplied original Eudic template.

Usage: python tools/export-eudic-keywords.py ORIGINAL.eudic [OUTPUT_DIRECTORY]
The template's headwords, search index, metadata, and language ordering are kept.
Only definition records and the offsets for the rebuilt data blocks are changed.
An editable UTF-8 source in Eudic Builder's word@HTML format is also exported.
"""
import hashlib
import html
import json
from pathlib import Path
import re
import struct
import sys
from urllib.parse import unquote
import zlib

TEMPLATE_SHA256 = '837035ca2a5979ed624e32af7d1b1b7ba94bff69c4f46d5c388a1a1c67ed6d20'
TITLE = re.compile(r'<font size="\+2">(.*?)</font>', re.S)
HAN = re.compile(r'[\u4e00-\u9fff]')
ROOT = Path(__file__).resolve().parents[1]


def clean_title(value):
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip(':： ')


def parse(raw):
    index_start, strings_start = struct.unpack_from('<QQ', raw, 1085)
    strings_size, count, record_size = struct.unpack_from('<III', raw, 1101)
    suffix_start, block_size = struct.unpack_from('<QI', raw, 1113)
    block_count = struct.unpack_from('<I', raw, 1242)[0]
    offsets = struct.unpack_from(f'<{block_count}Q', raw, 1246)
    assert record_size == 16 and raw[offsets[0]-1] == 1
    assert struct.unpack_from('<I', raw, 6)[0] == offsets[0]
    assert suffix_start == strings_start + strings_size
    assert strings_start == index_start + 4 + count * 16 + 4
    payload = bytearray()
    for i, offset in enumerate(offsets):
        block_end = offsets[i+1] if i+1 < len(offsets) else index_start
        stream = zlib.decompressobj()
        block = stream.decompress(raw[offset:block_end]) + stream.flush()
        assert stream.eof and not stream.unused_data and not stream.unconsumed_tail
        assert len(block) == block_size or i+1 == len(offsets)
        payload.extend(block)
    assert index_start - offsets[-1] == struct.unpack_from('<I', raw, 1081)[0]
    records = []
    previous = 0
    for i in range(count):
        offset, length, word_end = struct.unpack_from('<QII', raw, index_start+4+i*16)
        word = raw[strings_start+previous:strings_start+word_end].decode('utf-8')
        definition = payload[offset:offset+length].decode('utf-8')
        assert len(payload[offset:offset+length]) == length
        records.append((word, definition, word_end))
        previous = word_end
    assert previous == strings_size
    return {
        'payload': bytes(payload), 'records': records, 'block_size': block_size,
        'index_start': index_start, 'strings_start': strings_start,
        'suffix_start': suffix_start, 'offsets': offsets,
    }


def repack(template, payload, index):
    old = parse(template)
    blocks = [zlib.compress(payload[i:i+old['block_size']])
              for i in range(0, len(payload), old['block_size'])]
    first_offset = 1246 + 8*len(blocks) + 1
    offsets = []
    position = first_offset
    for block in blocks:
        offsets.append(position)
        position += len(block)
    index_start = position
    strings = template[old['strings_start']:old['suffix_start']]
    suffix = template[old['suffix_start']:]
    prefix = bytearray(template[:1242])
    strings_start = index_start + 4 + len(index) + 4
    struct.pack_into('<I', prefix, 6, first_offset)
    struct.pack_into('<I', prefix, 1081, len(blocks[-1]))
    struct.pack_into('<QQ', prefix, 1085, index_start, strings_start)
    struct.pack_into('<Q', prefix, 1113, strings_start+len(strings))
    prefix.extend(struct.pack('<I', len(blocks)))
    prefix.extend(struct.pack(f'<{len(blocks)}Q', *offsets))
    prefix.extend(b'\x01')
    return (bytes(prefix) + b''.join(blocks)
            + template[old['index_start']:old['index_start']+4]
            + index + template[old['strings_start']-4:old['strings_start']]
            + strings + suffix)


def export(template_path, output_dir):
    template = template_path.read_bytes()
    if hashlib.sha256(template).hexdigest() != TEMPLATE_SHA256:
        raise ValueError('Unexpected original Eudic template; do not reuse offsets with another file')
    old = parse(template)
    original_index = template[old['index_start']+4:old['strings_start']-4]
    # A byte-exact rebuild of the unmodified source checks the binary layout.
    assert repack(template, old['payload'], original_index) == template
    dictionary = json.loads((ROOT/'public/keyword-data/keywords.json').read_text(encoding='utf-8'))
    entries = dictionary['entries']
    by_titles = {(entry['en'], entry['zh']): entry for entry in entries}
    assert len(by_titles) == len(entries) == 146
    source_digest = hashlib.sha256((ROOT/'public/keyword-data/keywords.json').read_bytes()).hexdigest()
    expected = []
    index = bytearray()
    payload = bytearray()
    source_lines = []
    linked = set()
    found = set()
    for word, original_definition, word_end in old['records']:
        titles = [clean_title(t) for t in TITLE.findall(original_definition)]
        assert len(titles) == 2
        english = next(t for t in titles if not HAN.search(t))
        chinese = next(t for t in titles if HAN.search(t))
        entry = by_titles[(english, chinese)]
        en_definition, zh_definition = entry['definitionHtml'].split('<hr>', 1)
        definition = ('<hr>'.join((zh_definition, en_definition))
                      if HAN.search(titles[0]) else entry['definitionHtml'])
        assert 'Too lazy to input' not in definition
        assert '\n' not in definition and '\r' not in definition
        found.add((english, chinese))
        linked.update(unquote(target) for target in re.findall(r'''href=['"]dic://([^'"]+)''', definition))
        encoded = definition.encode('utf-8')
        index.extend(struct.pack('<QII', len(payload), len(encoded), word_end))
        payload.extend(encoded)
        expected.append((word, definition, word_end))
        source_lines.append(word+'@'+definition)
    assert found == set(by_titles)
    assert linked <= {word for word, _, _ in expected}, linked - {word for word, _, _ in expected}
    result = repack(template, bytes(payload), bytes(index))
    rebuilt = parse(result)
    assert rebuilt['records'] == expected
    assert result[rebuilt['suffix_start']:] == template[old['suffix_start']:]
    assert len(rebuilt['records']) == 292
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir/'KF关键词_中英补全版.eudic'
    output.write_bytes(result)
    assert parse(output.read_bytes())['records'] == expected
    source = output_dir/'KF关键词_中英补全版_制作源文件.txt'
    source.write_text('\n'.join(source_lines)+'\n', encoding='utf-8-sig')
    readback = source.read_text(encoding='utf-8-sig').splitlines()
    assert [line.split('@', 1) for line in readback] == [[w, d] for w, d, _ in expected]
    report = {
        'sourceJsonSha256': source_digest, 'templateSha256': TEMPLATE_SHA256,
        'eudicSha256': hashlib.sha256(result).hexdigest(),
        'keywordCount': 146, 'lookupEntryCount': 292,
        'linkedHeadwordCount': len(linked), 'unresolvedLinks': [],
        'remainingPlaceholders': 0, 'originalRebuildByteExact': True,
        'allDefinitionsReadBackExactly': True, 'appImportTested': False,
    }
    (output_dir/'导出校验.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'Created {output} ({len(result)} bytes)')
    print(f'Created {source}')
    print('Validated 146 keywords, 292 lookup entries, all definitions and cross-references.')
    return output


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        raise SystemExit(__doc__)
    destination = Path(sys.argv[2]) if len(sys.argv) == 3 else ROOT.parent/'output/dictionary'
    export(Path(sys.argv[1]), destination)
