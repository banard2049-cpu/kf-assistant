"""Match storybook portrait display colors to the previous knight portraits.

Reads both image sets without modifying their pixels. Writes per-knight SVG
color matrices and the shared browser filter script. Geometry stays unchanged.
Requires NumPy, SciPy, scikit-image and Pillow.
"""

import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import map_coordinates
from skimage.feature import SIFT, match_descriptors
from skimage.measure import ransac
from skimage.transform import AffineTransform


ROOT = Path(__file__).resolve().parents[1]
SPECS = json.loads(Path(__file__).with_name('knight-story-portrait-crops.json').read_text(encoding='utf-8'))


def fit_colors(current, reference):
    design = np.column_stack([current, np.ones(len(current))])
    identity = np.vstack([np.eye(3), np.zeros(3)])
    weights = np.ones(len(current))
    # Robust regression rejects scan texture and the remaining alignment outliers.
    regularizer = np.diag([1, 1, 1, .1]) * (len(current) * .0003)
    for _ in range(15):
        transform = np.linalg.solve(design.T @ (weights[:, None] * design) + regularizer,
                                    design.T @ (weights[:, None] * reference) + regularizer @ identity)
        residual = np.linalg.norm(design @ transform - reference, axis=1)
        cutoff = max(.025, float(np.median(residual)) * 1.5)
        weights = np.minimum(1, cutoff / np.maximum(residual, 1e-6))
    corrected = np.clip(design @ transform, 0, 1)
    return transform, float(np.mean(np.linalg.norm(current - reference, axis=1))), float(np.mean(np.linalg.norm(corrected - reference, axis=1)))


def main():
    results = {}
    for knight in SPECS:
        old_path = ROOT / 'output/knight-story-portraits/originals' / f'{knight}-avatar.jpg'
        new_path = ROOT / 'public/assets/heroes' / f'{knight}-avatar.jpg'
        with Image.open(old_path) as image:
            old = image.convert('RGB')
        with Image.open(new_path) as image:
            current = image.convert('RGB').resize((384, 384), Image.Resampling.LANCZOS)
        old_sift, current_sift = SIFT(), SIFT()
        old_sift.detect_and_extract(np.asarray(old.convert('L').filter(ImageFilter.GaussianBlur(.6)), dtype=float) / 255)
        current_sift.detect_and_extract(np.asarray(current.convert('L').filter(ImageFilter.GaussianBlur(.6)), dtype=float) / 255)
        y, x = old_sift.keypoints.T
        mask = (y > old.height * .17) & (x > 5) & (x < old.width - 5) & (y < old.height - 5)
        matches = match_descriptors(current_sift.descriptors, old_sift.descriptors[mask], max_ratio=.85, cross_check=True)
        if len(matches) < 5:
            raise ValueError(f'Not enough matching artwork features: {knight}, {len(matches)}')
        source_points = current_sift.keypoints[matches[:, 0]][:, ::-1]
        target_points = old_sift.keypoints[mask][matches[:, 1]][:, ::-1]
        registration, inliers = ransac((source_points, target_points), AffineTransform,
                                       min_samples=3, residual_threshold=2.5, max_trials=2500, rng=17)
        if inliers.sum() < 5:
            raise ValueError(f'Unreliable artwork alignment: {knight}, {inliers.sum()} inliers')
        yy, xx = np.mgrid[3:381:3, 3:381:3]
        source_xy = np.column_stack([xx.ravel(), yy.ravel()])
        target_xy = registration(source_xy)
        valid = (target_xy[:, 0] > 5) & (target_xy[:, 0] < old.width - 5) & (target_xy[:, 1] > old.height * .18) & (target_xy[:, 1] < old.height - 5)
        current_rgb = np.asarray(current.filter(ImageFilter.GaussianBlur(1.2)), dtype=float) / 255
        reference_rgb = np.asarray(old.filter(ImageFilter.GaussianBlur(1.2)), dtype=float) / 255
        source_xy, target_xy = source_xy[valid], target_xy[valid]
        source_colors = current_rgb[source_xy[:, 1], source_xy[:, 0]]
        reference_colors = np.column_stack([map_coordinates(reference_rgb[..., channel], [target_xy[:, 1], target_xy[:, 0]], order=1) for channel in range(3)])
        transform, before, after = fit_colors(source_colors, reference_colors)
        values = []
        for channel in range(3):
            values.extend([*transform[:3, channel], 0, transform[3, channel]])
        values.extend([0, 0, 0, 1, 0])
        results[knight] = {
            'colorMatrix': [round(float(value), 7) for value in values],
            'referenceSHA256': hashlib.sha256(old_path.read_bytes()).hexdigest(),
            'sourceSHA256': hashlib.sha256(new_path.read_bytes()).hexdigest(),
            'matchingLandmarks': int(inliers.sum()), 'samplePixels': len(source_colors),
            'meanRGBErrorBefore': round(before, 6), 'meanRGBErrorAfter': round(after, 6),
            'registration': registration.params[:2].tolist(),
        }
        print(f'{knight}: {int(inliers.sum())} landmarks; color difference {before:.4f} -> {after:.4f}', flush=True)
    path = ROOT / 'tools/knight-portrait-color-match.json'
    path.write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
    runtime = {knight: data['colorMatrix'] for knight, data in results.items()}
    script = '''// Generated by tools/match-knight-portrait-colors.py. Source pixels and framing stay unchanged.
(() => {
  "use strict";
  if (document.getElementById("kf-knight-portrait-color-filters")) return;
  const matrices = MATRICES;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.id = "kf-knight-portrait-color-filters";
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.cssText = "position:absolute;pointer-events:none;overflow:hidden";
  const defs = document.createElementNS(ns, "defs");
  const rules = [];
  for (const [knight, matrix] of Object.entries(matrices)) {
    const id = `kf-knight-color-${knight}`;
    const filter = document.createElementNS(ns, "filter");
    filter.id = id;
    filter.setAttribute("color-interpolation-filters", "sRGB");
    const color = document.createElementNS(ns, "feColorMatrix");
    color.setAttribute("type", "matrix"); color.setAttribute("values", matrix.join(" "));
    filter.append(color); defs.append(filter);
    rules.push(`:where(img[src*="/assets/heroes/${knight}-avatar.jpg"]:not([data-portrait-ungraded])) { --knight-portrait-color:url("#${id}"); filter:var(--knight-portrait-color); }`);
  }
  svg.append(defs); document.body.append(svg);
  const style = document.createElement("style");
  style.id = "kf-knight-portrait-color-styles"; style.textContent = rules.join("\\n");
  document.head.append(style);
})();
'''.replace('MATRICES', json.dumps(runtime, separators=(',', ':')))
    (ROOT / 'public/knight-portrait-colors.js').write_text(script, encoding='utf-8', newline='\n')


if __name__ == '__main__':
    main()
