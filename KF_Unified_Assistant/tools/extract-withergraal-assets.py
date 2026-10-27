"""Render the colour Withergraal map and stat symbols.

Usage: python extract-withergraal-assets.py --source ".../KF_Withergraal_Sheets.pdf"
The colour map is read from the sibling KF_Withergraal.pdf unless --map-source
is supplied. The sheets PDF supplies the symbols. No PDFs change.
"""
import argparse
from pathlib import Path
import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SYMBOLS = {
    "stat-p": (2, (347, 707, 377, 737)),
    "stat-h-bang": (2, (348, 739, 383, 770)),
    "stat-circle-bang": (2, (878, 799, 918, 833)),
    "stat-dragon": (2, (347, 1277, 381, 1309)),
    "stat-down": (2, (348, 1310, 380, 1342)),
    "stat-h-arrows": (3, (358, 454, 405, 487)),
    "stat-cards": (3, (889, 295, 921, 327)),
    "stat-sword": (3, (888, 327, 921, 355)),
}


def crop_page(page, raw, reference_size, zoom):
    width, height = reference_size
    clip = fitz.Rect(raw[0] / width * page.rect.width, raw[1] / height * page.rect.height,
                     raw[2] / width * page.rect.width, raw[3] / height * page.rect.height)
    return page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip, alpha=False)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--map-source", type=Path,
                        help="Colour rules PDF; defaults to KF_Withergraal.pdf beside --source")
    args = parser.parse_args()
    output = ROOT / "public/assets/rogue"
    output.mkdir(parents=True, exist_ok=True)
    document = fitz.open(args.source)
    map_source = args.map_source or args.source.with_name("KF_Withergraal.pdf")
    colour_document = fitz.open(map_source)
    if len(colour_document) < 5:
        raise ValueError("The colour Withergraal rules PDF must contain map pages 4 and 5")
    pages = []
    for source_index, index in enumerate((3, 4)):
        if colour_document[index].rect != document[source_index].rect:
            raise ValueError("Colour map and sheets page sizes differ; verify node alignment before extracting")
        pix = colour_document[index].get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        pages.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
    canvas = Image.new("RGB", (sum(page.width for page in pages), max(page.height for page in pages)), "white")
    offset = 0
    for page in pages:
        canvas.paste(page, (offset, 0)); offset += page.width
    canvas.save(output / "withergraal-tree.jpg", quality=94, optimize=True)
    for name, (index, raw) in SYMBOLS.items():
        pix = crop_page(document[index], raw, (1191, 1684), 6)
        (output / f"{name}.png").write_bytes(pix.tobytes("png"))
    print(f"Saved colour map from {map_source.name} pages 4-5, "
          f"{len(SYMBOLS)} stat symbols to {output}")

if __name__ == "__main__":
    main()
