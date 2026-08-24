#!/usr/bin/env python3
"""Build a self-contained Docker ZIP for KF Unified Assistant."""

from __future__ import annotations

import argparse
import re
import shutil
import zipfile
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
EXPORT_ROOT = PROJECT_ROOT / "export"
DOCKER_SOURCE = PROJECT_ROOT / "tools" / "packaging" / "docker"
CACHE_ROOT = PROJECT_ROOT / "tools" / ".packaging-cache" / "docker-build"


def safe_version(value: str) -> str:
    value = value.removeprefix("v")
    return re.sub(r"[^0-9A-Za-z._-]", "-", value or "local")


def copy_public(destination: Path) -> None:
    source = PROJECT_ROOT / "public"
    shutil.copytree(source, destination / "public", dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns("assets", "*.log", "php_errors.log"))


def build(version: str) -> Path:
    package_name = f"KF-Unified-Assistant-Docker-{safe_version(version)}"
    EXPORT_ROOT.mkdir(parents=True, exist_ok=True)
    stage = CACHE_ROOT / package_name
    if stage.exists():
        shutil.rmtree(stage)
    stage.mkdir(parents=True)
    copy_public(stage)
    (stage / "data").mkdir()
    (stage / "backups").mkdir()
    shutil.copy2(DOCKER_SOURCE / "Dockerfile", stage / "Dockerfile")
    shutil.copy2(DOCKER_SOURCE / "compose.yaml", stage / "compose.yaml")
    shutil.copy2(DOCKER_SOURCE / "README.txt", stage / "README-DOCKER.txt")
    output = EXPORT_ROOT / f"{package_name}.zip"
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(stage.rglob("*")):
            relative = Path(package_name) / path.relative_to(stage)
            if path.is_dir():
                if not any(path.iterdir()):
                    archive.writestr(relative.as_posix().rstrip("/") + "/", b"")
                continue
            archive.write(path, relative.as_posix())
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the KF Docker package ZIP.")
    parser.add_argument("--version", default="local")
    args = parser.parse_args()
    output = build(args.version)
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
