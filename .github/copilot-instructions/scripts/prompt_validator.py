"""Simple prompt template front-matter validator for paperless-ai
Usage: python scripts/prompt_validator.py <path-to-prompt-file>

Checks for required front-matter fields and basic values.
"""
import sys
import yaml
from typing import List, Tuple

REQUIRED_FIELDS = ["name", "version", "risk-level", "owner"]
ALLOWED_RISKS = {"low", "medium", "high"}


def load_front_matter(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        text = f.read()
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            fm = parts[1]
            return yaml.safe_load(fm) or {}
    return {}


def validate(path: str) -> Tuple[bool, List[str]]:
    """Validate prompt front-matter.

    Returns a tuple (is_valid, issues). `issues` is a list of human-readable
    strings describing problems. This function is safe to call programmatically
    from generators and CI.
    """
    fm = load_front_matter(path)
    errors: List[str] = []
    for field in REQUIRED_FIELDS:
        if field not in fm:
            errors.append(f"Missing required front-matter field: {field}")
    if "risk-level" in fm and fm.get("risk-level") not in ALLOWED_RISKS:
        errors.append(f"Invalid risk-level: {fm.get('risk-level')}. Allowed: {ALLOWED_RISKS}")
    if errors:
        return False, errors
    return True, []


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python scripts/prompt_validator.py <prompt_file>")
        sys.exit(1)
    ok, issues = validate(sys.argv[1])
    if not ok:
        print("Validation failed for", sys.argv[1])
        for e in issues:
            print(" -", e)
        sys.exit(2)
    print("OK:", sys.argv[1])
    sys.exit(0)
