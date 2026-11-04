import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('scanner', ROOT / 'tools/scan-boss-keywords.py')
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)
dictionary = json.loads((ROOT / 'public/keyword-data/keywords.json').read_text(encoding='utf-8'))['entries']


class KeywordMatchingTests(unittest.TestCase):
    def test_numeric_chinese_parameters_and_ocr_spacing(self):
        self.assertIn('Poison', scanner.match_keywords('承受 中 毒 2。', dictionary))
        self.assertIn('Bane', scanner.match_keywords('获得灾祸 ３', dictionary))

    def test_english_numeric_parameters(self):
        self.assertIn('Knockback X', scanner.match_keywords('Knockback 3', dictionary))
        self.assertIn('OverpowerX+', scanner.match_keywords('Overpower4+', dictionary))
        self.assertIn('OvercomeX+', scanner.match_keywords('OVERCOME 2+', dictionary))

    def test_discard_as_an_ordinary_verb_is_not_a_keyword(self):
        self.assertNotIn('Discard', scanner.match_keywords('You may discard a Hex you have.', dictionary))
        self.assertNotIn('Discard', scanner.match_keywords('Discard 1 Armor token.', dictionary))
        self.assertIn('Discard', scanner.match_keywords('Discard.', dictionary))

    def test_specific_phrase_does_not_also_match_substring(self):
        self.assertEqual(scanner.match_keywords('Advanced Bypass', dictionary), ['Advanced Bypass'])
        self.assertEqual(scanner.match_keywords('高级穿身', dictionary), ['Advanced Bypass'])
        self.assertEqual(scanner.match_keywords('Advanced Bypass, then Bypass', dictionary), ['Advanced Bypass', 'Bypass'])


if __name__ == '__main__':
    unittest.main()
