
"""
Per-folder README generator.

Safe, deterministic generator that extracts small, local summaries for files
and writes a README.md per folder (if changed).

Designed to run locally or in CI. By default it targets the parent folder of
the scripts directory (i.e. `.github/copilot-instructions`).

Usage:
    python generate_readmes.py [target_dir]

Behavior:
- Scans directories recursively
- Extracts simple summaries (Python AST docstrings, leading comments for JS/TS,
    first heading for markdown)
- Writes README.md only when content changed
- Updates `.doc_index.json` at target root with folder -> checksum mapping

No external LLM calls. Safe to run in public CI.
"""

from __future__ import annotations

import ast
import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

# Try to import sanitize_text, fallback if not available
try:
    from .sanitizer import sanitize_text
except ImportError:
    def sanitize_text(text):
        return text, None

GENERATOR_VERSION = "0.2.0"
EXCLUDE_DIRS = {
    ".git", "__pycache__", ".venv", ".mypy_cache", ".pytest_cache",
    "node_modules", "dist", "build"
}


def file_checksum(path: Path) -> str:
    """Return the SHA-1 checksum of a file."""
    h = hashlib.sha1()
    with path.open("rb") as f:
        while True:
            chunk = f.read(8192)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def summarize_python(path: Path) -> str:
    """Summarize a Python file by extracting docstrings and top-level
    symbols."""
    try:
        src = path.read_text(encoding="utf-8")
        tree = ast.parse(src)
        module_doc = ast.get_docstring(tree) or ""
        parts = []
        if module_doc:
            parts.append(module_doc.splitlines()[0])
        # list top-level functions and classes
        for node in tree.body:
            if isinstance(node, ast.FunctionDef):
                doc = ast.get_docstring(node) or ""
                doc_line = doc.splitlines()[0] if doc else 'no doc'
                parts.append(f"func: {node.name}() - {doc_line}")
            if isinstance(node, ast.ClassDef):
                doc = ast.get_docstring(node) or ""
                doc_line = doc.splitlines()[0] if doc else 'no doc'
                parts.append(f"class: {node.name} - {doc_line}")
        return "\n".join(parts[:8])
    except (OSError, SyntaxError, UnicodeDecodeError):
        return "(could not parse Python file)"


def summarize_js(path: Path) -> str:
    """Summarize a JS/TS file by extracting the first block comment or
    first line."""
    try:
        text = path.read_text(encoding="utf-8")
        # capture leading block comment or first 5 non-empty lines
        m = re.search(r"/\*([\s\S]{0,500})\*/", text)
        if m:
            return m.group(1).strip().splitlines()[0]
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        return lines[0] if lines else ""
    except (OSError, UnicodeDecodeError):
        return "(could not read file)"


def summarize_md(path: Path) -> str:
    """Summarize a markdown file by extracting the first heading or line."""
    try:
        text = path.read_text(encoding="utf-8")
        m = re.search(r"^#\s+(.*)$", text, re.MULTILINE)
        if m:
            return m.group(1).strip()
        return text.splitlines()[0] if text.splitlines() else ""
    except (OSError, UnicodeDecodeError):
        return ""


def validate_prompt_file(path: Path) -> Tuple[bool, List[str]]:
    """If the file is a prompt (markdown with front-matter), run the
    prompt validator and return (ok, issues). If validator not available,
    returns (True, []).
    """
    try:
        # import lazily to avoid hard dependency for other runs
        from .prompt_validator import validate
    except ImportError:
        try:
            from prompt_validator import validate
        except ImportError:
            return True, []
    try:
        ok, issues = validate(str(path))
        return ok, issues
    except Exception as exc:
        # Could be more specific if validator errors are known
        return True, [f"validator error: {exc}"]


def summarize_generic(path: Path) -> str:
    """Summarize a generic file by returning the first non-empty line."""
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
        # return first non-empty line
        for line in text.splitlines():
            if line.strip():
                return line.strip()[:200]
        return ""
    except (OSError, UnicodeDecodeError):
        return "(binary or unreadable)"


def summarize_file(path: Path) -> Tuple[str, str]:
    """Summarize a file based on its extension and return
    (summary, checksum)."""
    ext = path.suffix.lower()
    if ext == ".py":
        s = summarize_python(path)
    elif ext in {".js", ".ts"}:
        s = summarize_js(path)
    elif ext in {".md", ".markdown"}:
        s = summarize_md(path)
    else:
        s = summarize_generic(path)
    # Sanitize the summary to be safe for logs / potential LLM use later
    s_sanitized, _ = sanitize_text(s)
    return s_sanitized, file_checksum(path)


def build_readme_for_folder(folder: Path, rel_root: Path) -> Tuple[str, str]:
    """Builds a README.md content and folder checksum for a given folder."""
    files_in_folder = [
        p for p in sorted(folder.iterdir())
        if p.is_file() and p.name != "README.md"
    ]
    lines: List[str] = []
    title = folder.name or str(folder)
    lines.append(f"# {title}")
    lines.append("")
    lines.append(
        f"_Generated by generator {GENERATOR_VERSION} on "
        f"{datetime.utcnow().isoformat()}Z_"
    )
    lines.append("")
    if not files_in_folder:
        lines.append("(no files in this folder)")
    else:
        lines.append("## Files")
        lines.append("")
        folder_hash_input = []
        for file_path in files_in_folder:
            rel = file_path.relative_to(rel_root)
            summ, ch = summarize_file(file_path)
            folder_hash_input.append(f"{rel.as_posix()}:{ch}")
            lines.append(f"- `{rel.name}` — {summ or '(no summary)'}")
        # deterministic folder checksum
        folder_checksum = hashlib.sha1(
            "\n".join(folder_hash_input).encode()
        ).hexdigest()
        lines.append("")
        lines.append(f"_folder_checksum: {folder_checksum}_")
    content = "\n".join(lines) + "\n"
    return content, locals().get('folder_checksum', '')


def should_skip(dirpath: Path) -> bool:
    """Return True if the directory should be skipped based on EXCLUDE_DIRS."""
    return any(part in EXCLUDE_DIRS for part in dirpath.parts)


def main(target: str | None = None) -> int:
    """Main entry point for the README generator script."""
    base = Path(target) if target else Path(__file__).resolve().parents[1]
    base = base.resolve()
    print(f"Target root: {base}")
    # CI behavior: if FAIL_ON_VALIDATION env var is set to a truthy value,
    # generator will exit non-zero when prompt validation issues are found.
    fail_on_validation = os.environ.get(
        "FAIL_ON_VALIDATION", "0"
    ) not in ("0", "")
    validation_issues_found = False
    index: Dict[str, Dict] = {}
    for root, dirs, _ in os.walk(base):
        rootp = Path(root)
        # mutate dirs in-place to skip excluded
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        if should_skip(rootp):
            continue
        # prepare README
        readme_path = rootp / "README.md"
        content, folder_checksum = build_readme_for_folder(rootp, base)
        # if this folder is a prompts folder, run prompt validation for each md
        if rootp.name == 'prompts':
            for file_path in sorted(rootp.iterdir()):
                # skip README files which are indices, not prompts
                if file_path.name.lower() == 'readme.md':
                    continue
                if file_path.suffix.lower() in {'.md', '.markdown'}:
                    ok, issues = validate_prompt_file(file_path)
                    if not ok:
                        validation_issues_found = True
                        print(f"Prompt validation issues in {file_path}:")
                        for issue in issues:
                            print(f" - {issue}")
        previous = (
            readme_path.read_text(encoding="utf-8")
            if readme_path.exists() else None
        )
        if previous != content:
            print(f"Writing README for {rootp}")
            readme_path.write_text(content, encoding="utf-8")
        else:
            print(f"No change for {rootp}")
        rel = rootp.relative_to(base)
        index[str(rel.as_posix())] = {
            "readme": "README.md",
            "folder_checksum": folder_checksum,
            "generated_on": datetime.utcnow().isoformat() + "Z",
            "generator_version": GENERATOR_VERSION,
        }
    # write index at base
    index_file = base / ".doc_index.json"
    index_file.write_text(json.dumps(index, indent=2), encoding="utf-8")
    print(f"Wrote index to {index_file}")
    if fail_on_validation and validation_issues_found:
        print(
            "One or more prompt validation issues were found. "
            "Failing as requested by FAIL_ON_VALIDATION."
        )
        return 2
    return 0


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    sys.exit(main(arg))
