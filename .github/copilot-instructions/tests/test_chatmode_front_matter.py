import pathlib
import sys
from pathlib import Path

# Ensure scripts package parent dir on sys.path for import
ROOT = Path(__file__).resolve().parents[3]
import importlib.util

# dynamic import of prompt_validator from scripts folder
pv_path = ROOT / ".github" / "copilot-instructions" / "scripts" / "prompt_validator.py"
spec = importlib.util.spec_from_file_location("prompt_validator", str(pv_path))
pv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pv)
load_front_matter = pv.load_front_matter


def find_files(root: pathlib.Path):
    for p in root.rglob("*.chatmode.md"):
        yield p
    for p in root.rglob("*.prompt.md"):
        yield p


def test_chatmode_and_prompt_front_matter_present():
    root = pathlib.Path(__file__).resolve().parents[1]
    missing = []
    for f in find_files(root):
        try:
            fm = load_front_matter(str(f))
        except Exception:
            missing.append((str(f), "could not parse front-matter"))
            continue
        for key in ("name", "version", "risk-level", "owner"):
            if key not in fm:
                missing.append((str(f), f"missing:{key}"))
    assert not missing, f"Front-matter issues: {missing}"
