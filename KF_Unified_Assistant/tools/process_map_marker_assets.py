from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
MAP_ROOT = ROOT / "public" / "modules" / "map"
LEGACY_ROOT = ROOT / "public"
MAP_DATA_FILES = (
    MAP_ROOT / "data" / "map-data.js",
    LEGACY_ROOT / "data" / "map-data.js",
)

MARKERS = (
    (
        "fog",
        MAP_ROOT / "assets" / "tokens" / "fog.jpg",
        (255, 255, 255),
        12,
    ),
    (
        "surge",
        MAP_ROOT / "assets" / "tokens" / "surge.jpg",
        (128, 128, 128),
        16,
    ),
    (
        "flood",
        MAP_ROOT / "assets" / "tokens" / "flood.jpg",
        (128, 128, 128),
        16,
    ),
    (
        "generic",
        MAP_ROOT
        / "assets"
        / "images"
        / "httpssteamusercontentaakamaihdnetugc10792521070177147F375BA9D7F1EF7C2ABAA9D04F55839FA6FC24A94.jpg",
        (255, 255, 255),
        12,
    ),
)


def foreground_cutout(
    source: Path,
    background: tuple[int, int, int],
    foreground_distance: int,
) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    distances = [
        [
            max(abs(pixels[x, y][channel] - background[channel]) for channel in range(3))
            for x in range(width)
        ]
        for y in range(height)
    ]

    seen = bytearray(width * height)
    largest_component: list[int] = []
    for y in range(height):
        for x in range(width):
            start = y * width + x
            if seen[start] or distances[y][x] < foreground_distance:
                continue
            component: list[int] = []
            queue = deque((start,))
            seen[start] = 1
            while queue:
                index = queue.popleft()
                component.append(index)
                current_x = index % width
                current_y = index // width
                for next_x, next_y in (
                    (current_x - 1, current_y),
                    (current_x + 1, current_y),
                    (current_x, current_y - 1),
                    (current_x, current_y + 1),
                ):
                    if not (0 <= next_x < width and 0 <= next_y < height):
                        continue
                    next_index = next_y * width + next_x
                    if seen[next_index] or distances[next_y][next_x] < foreground_distance:
                        continue
                    seen[next_index] = 1
                    queue.append(next_index)
            if len(component) > len(largest_component):
                largest_component = component

    matte = bytearray(width * height)
    for index in largest_component:
        matte[index] = 255
    alpha = Image.frombytes("L", (width, height), bytes(matte))
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.55))
    image.putalpha(alpha)

    return image


def main() -> None:
    targets = (
        MAP_ROOT / "assets" / "tokens",
        LEGACY_ROOT / "assets" / "tokens",
    )
    for name, source, background, foreground_distance in MARKERS:
        image = foreground_cutout(
            source,
            background,
            foreground_distance,
        )
        alpha_histogram = image.getchannel("A").histogram()
        alpha = image.getchannel("A")
        corners = (
            alpha.getpixel((0, 0)),
            alpha.getpixel((image.width - 1, 0)),
            alpha.getpixel((0, image.height - 1)),
            alpha.getpixel((image.width - 1, image.height - 1)),
        )
        if any(corners) or not alpha_histogram[0] or not alpha_histogram[255]:
            raise ValueError(f"Invalid alpha matte for {name}: corners={corners}")
        print(
            f"{name}: {alpha_histogram[0]} transparent, "
            f"{sum(alpha_histogram[1:255])} partially transparent, "
            f"{alpha_histogram[255]} opaque pixels"
        )
        for target_dir in targets:
            target_dir.mkdir(parents=True, exist_ok=True)
            target = target_dir / f"{name}.png"
            image.save(target, "PNG", optimize=True)
            print(target.relative_to(ROOT))

    marker_paths = {
        '"surge":"assets/tokens/surge.jpg"': '"surge":"assets/tokens/surge.png"',
        '"flood":"assets/tokens/flood.jpg"': '"flood":"assets/tokens/flood.png"',
        '"generic":"assets/images/httpssteamusercontentaakamaihdnetugc10792521070177147F375BA9D7F1EF7C2ABAA9D04F55839FA6FC24A94.jpg"': '"generic":"assets/tokens/generic.png"',
        '"quest":"assets/images/httpssteamusercontentaakamaihdnetugc10792521070177147F375BA9D7F1EF7C2ABAA9D04F55839FA6FC24A94.jpg"': '"quest":"assets/tokens/generic.png"',
    }
    for data_file in MAP_DATA_FILES:
        source = data_file.read_text(encoding="utf-8")
        for old_path, new_path in marker_paths.items():
            occurrences = source.count(old_path)
            if occurrences > 1:
                raise ValueError(
                    f"Expected at most one marker path in {data_file}, found {occurrences}: "
                    f"{old_path}"
                )
            source = source.replace(old_path, new_path)
            if source.count(new_path) != 1:
                raise ValueError(f"Missing updated marker path in {data_file}: {new_path}")
        data_file.write_text(source, encoding="utf-8")
        print(data_file.relative_to(ROOT))


if __name__ == "__main__":
    main()
