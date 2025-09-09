import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))

import time

from scripts import py_utils


def test_sha256_hex_string_vs_bytes():
    s = "hello world"
    b = s.encode("utf-8")
    assert py_utils.sha256_hex(s) == py_utils.sha256_hex(b)


def test_retryable_fallback_behavior():
    # This test verifies the retry wrapper will retry on failure and then succeed
    calls = {"count": 0}

    @py_utils.retryable(attempts=3, min_wait=0.01, max_wait=0.02)
    def flaky():
        calls["count"] += 1
        if calls["count"] < 3:
            raise RuntimeError("fail")
        return "ok"

    start = time.time()
    res = flaky()
    duration = time.time() - start

    assert res == "ok"
    assert calls["count"] == 3
    # ensure it didn't take forever (sanity check for backoff)
    assert duration < 1.0
