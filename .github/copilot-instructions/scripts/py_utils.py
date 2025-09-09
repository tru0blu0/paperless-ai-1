"""Small Python utilities for Paperless-AI tests and workers.

Includes:
- sha256_hex: stable content hashing for cache keys
- retryable: decorator that uses tenacity when available, otherwise a small fallback retry
"""
from __future__ import annotations

import hashlib
import time
import random
from typing import Callable, Any


def sha256_hex(obj: bytes | str) -> str:
    """Return a hex sha256 for a bytes or string input.

    Useful for stable cache keys (document content + model + options).
    """
    if isinstance(obj, str):
        obj = obj.encode("utf-8")
    return hashlib.sha256(obj).hexdigest()


try:
    # Prefer tenacity if available for robust retry semantics
    from tenacity import retry as _tenacity_retry, stop_after_attempt, wait_exponential


    def retryable(attempts: int = 3, min_wait: float = 1.0, max_wait: float = 10.0):
        """Return a decorator that retries using tenacity with exponential backoff.

        Args:
            attempts: max attempts (including first try)
            min_wait: minimum wait multiplier
            max_wait: max wait cap
        """

        def deco(fn: Callable[..., Any]):
            return _tenacity_retry(stop=stop_after_attempt(attempts), wait=wait_exponential(multiplier=min_wait, max=max_wait))(fn)

        return deco


except Exception:  # pragma: no cover - fallback if tenacity not installed
    def retryable(attempts: int = 3, min_wait: float = 1.0, max_wait: float = 10.0):
        """Fallback retry decorator using exponential backoff with jitter.

        This keeps tests and local dev working without adding a dependency.
        """

        def deco(fn: Callable[..., Any]):
            def wrapper(*args, **kwargs):
                last_exc = None
                for i in range(attempts):
                    try:
                        return fn(*args, **kwargs)
                    except Exception as exc:  # noqa: BLE001 - we intentionally catch broad exceptions for retry demonstration
                        last_exc = exc
                        if i == attempts - 1:
                            raise
                        # exponential backoff with small jitter
                        sleep = min(max_wait, min_wait * (2 ** i)) + random.random() * 0.1
                        time.sleep(sleep)

            # preserve a couple attributes for introspection
            try:
                wrapper.__name__ = fn.__name__
                wrapper.__doc__ = fn.__doc__
            except Exception:
                pass
            return wrapper

        return deco
