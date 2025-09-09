import sys
from pathlib import Path
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from scripts.sanitizer import sanitize_text


def test_sanitize_email_ssn():
    text = 'Contact: john.doe@example.com and SSN 123-45-6789.'
    s, r = sanitize_text(text)
    assert '<EMAIL_REDACTED>' in s
    assert '<PII_REDACTED>' in s
    assert r['email_replacements'] == 1
    assert r['ssn_replacements'] == 1
