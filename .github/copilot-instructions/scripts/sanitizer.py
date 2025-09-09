"""Simple sanitization helper used by orchestrator and prompts.
Provides deterministic redaction for common PII patterns.
"""
import re
from typing import Tuple

EMAIL_RE = re.compile(r"[\w\.-]+@[\w\.-]+")
PHONE_RE = re.compile(r"\b(?:\+\d{1,3}[ -]?)?(?:\(\d{1,4}\)|\d{1,4})[ -]?\d{1,4}(?:[ -]?\d{1,9})\b")
SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

def sanitize_text(text: str) -> Tuple[str, dict]:
    """Return sanitized text and a small report of replacements.

    Deterministic placeholders are used to avoid leaking values.
    """
    report = {}
    text, n = EMAIL_RE.subn('<EMAIL_REDACTED>', text)
    report['email_replacements'] = n
    # redact SSNs first so the permissive phone regex doesn't capture them
    text, n = SSN_RE.subn('<PII_REDACTED>', text)
    report['ssn_replacements'] = n
    text, n = PHONE_RE.subn('<PHONE_REDACTED>', text)
    report['phone_replacements'] = n
    # normalize whitespace
    text = '\n'.join([line.strip() for line in text.splitlines() if line.strip()])
    return text, report

if __name__ == '__main__':
    import sys
    s = sys.stdin.read() if not sys.stdin.isatty() else 'Sample text 555-12-3456 test@example.com'
    out, rep = sanitize_text(s)
    print(out)
    print(rep)
