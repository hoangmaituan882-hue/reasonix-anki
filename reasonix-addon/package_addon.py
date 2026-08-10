"""Build the minimal installable Reasonix Anki addon archive."""

from __future__ import annotations

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo


SOURCE_ROOT = Path(__file__).resolve().parent
INCLUDE_FILES = (
    SOURCE_ROOT / "__init__.py",
    SOURCE_ROOT / "manifest.json",
    SOURCE_ROOT / "config.json",
)


def _files_to_package() -> list[Path]:
    files = list(INCLUDE_FILES)
    files.extend(
        source
        for source in sorted((SOURCE_ROOT / "reasonix_addon").glob("*.py"))
        if not source.name.startswith("qa_")
    )
    return files


def build_package(output: Path) -> Path:
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for source in _files_to_package():
            relative = source.relative_to(SOURCE_ROOT).as_posix()
            info = ZipInfo(relative, date_time=(2020, 1, 1, 0, 0, 0))
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, source.read_bytes())
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist/reasonix-anki-addon.ankiaddon"),
    )
    args = parser.parse_args()
    output = build_package(args.output)
    print(f"Built {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
