MOVE TO: instructions/python-paperless-ai.md
---
description: "Python coding conventions for paperless-ai: AI/ML, cloud, and document automation"
applyTo: "**/*.py"
---

# Paperless-AI Python Engineering Guidelines

This file contains practical, repo-aligned Python standards and patterns for Paperless-AI: document ingestion, parsing, background workers, and AI service integration.

Quick checklist (apply before committing):

- Formatting & linting: Black + Ruff + ruff rules recommended (D, ANN, PLW as baseline).
- Types: Use PEP 484 typing; prefer explicit type hints on public functions and dataclasses for models.
- Tests: pytest for unit & integration; use fixtures and mocks for external APIs.
- Secrets: Never hardcode; use env vars and GCP Secret Manager.
- Logging & observability: structured logging + OpenTelemetry/Prometheus metrics for critical flows.

Why these matter: Paperless-AI handles large documents and external LLMs — regressions or unobservable failures can be costly and slow to debug. The rules below map to the project's file layout (see `services/*.js` and Python scripts/workers) and emphasize observability, testability, and safe LLM usage.

1. Formatting, linting, and pre-commit

- Use Black for formatting. Configure a repo-level pyproject.toml for Black and Ruff.
- Use Ruff as the linter + auto-fixer. Enable selected rule groups (docstrings, typing, security S rules) and disable noisy rules where necessary.
- Add a pre-commit config that runs Black, Ruff, and a safety/security scanner (bandit or ruff S rules).

## Types, dataclasses, and models

- Prefer `dataclasses.dataclass` or Pydantic/BaseModel when validation/serialization is required for document models.
- Keep domain models small and immutable where possible. Example:

```python
from dataclasses import dataclass
from typing import List

@dataclass(frozen=True)
class DocumentChunk:
    id: str
    text: str
    tokens: int
    metadata: dict

def chunk_text(text: str, chunk_size: int = 1000) -> List[DocumentChunk]:
    ...
```

## Docstrings and public API

- Use Google or NumPy style docstrings and include types; keep examples minimal and reproducible.
- Document side effects (writes to DB/object storage) and idempotency guarantees. Prefer returning status objects instead of raising for expected failure modes in long-running jobs.

## Testing: unit, integration, and regression

- Unit tests: fast, deterministic, mock all external LLM/HTTP clients. Use `pytest` + `pytest-mock`.
- Integration tests: run against a local stack or test doubles. For LLMs use VCR/pytest-recording or provider sandbox keys.
- Regression/benchmarks: add a tiny benchmark suite (pytest + time measurement) for critical hot paths (parsing, embedding generation).

Testing example (mocking LLM call):

```python
def test_extract_entities(monkeypatch):
    monkeypatch.setattr('services.llm_client.run_llm', lambda *a, **k: {'text':'Alice'})
    result = extract_entities(b'...')
    assert 'Alice' in result
```

## External services, retries, and backoff

- Wrap external network/LLM calls with a retry policy (tenacity recommended) and add exponential backoff with jitter.
- Use circuit-breakers for critical upstreams to avoid cascading failures.

Example (tenacity):

```python
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=10))
def call_llm(prompt: str) -> dict:
    return llm_client.call(prompt)
```

## Caching & idempotency

- Cache deterministic outputs (embeddings, extraction results) keyed by content hash + model + parameters. Use Redis or the project's DB for a persistent cache.
- Ensure idempotency keys for jobs; workers should detect and dedupe in-flight or completed jobs.

## Concurrency and async patterns

- For I/O-bound work (HTTP, GCS/S3, DB), prefer async implementations (asyncio + aiohttp / aioboto3) or worker processes.
- CPU-bound work (OCR, PDF parsing) should run in a separate worker process pool (Celery, RQ, or a lightweight ProcessPoolExecutor) to avoid blocking single-threaded runtimes.

## Long-running jobs and background workers

- Offload heavy parsing and embedding creation to a job queue. Record job status and results in a small status table so the web UI can poll.
- Use small, idempotent tasks that can be retried safely.

## Observability: metrics, traces, and logs

- Emit metrics for LLM latency, embedding generation time, cache hits/misses, job queue depth, and error rates.
- Add tracing (OpenTelemetry) on request path: HTTP -> Job enqueue -> Worker -> LLM call.
- Use structured logs (JSON) and include request/job IDs for correlation.

## Secrets, credentials, and auth

- Use environment variables or GCP Secret Manager. Never include secrets in repository files.
- Limit service account scopes to least-privilege for storage, Pub/Sub, and Vertex AI.

## Security and input handling

- Validate inputs (file sizes, MIME types) early. Reject suspicious files and log metadata for triage.
- Sanitize HTML/XML and avoid insecure XML parsing (use defusedxml or lxml with safe config).

## Packaging and dependency management

- Keep a minimal requirements.txt or pyproject.toml. Pin direct dependencies in CI for reproducible builds.
- Run dependency audits in CI (safety / GitHub Dependabot) and set policy for regular upgrades for critical libraries (langchain-like, openai, google-cloud).

## CI & local dev

- CI should run linting, unit tests, and basic integration smoke tests. Keep the integration set small to run fast on PRs.
- Provide a devcontainer or docker-compose for local worker + Redis + Postgres to reproduce integration flows.

## LLM & RAG-specific guidance

- Treat LLM calls as side-effectful and expensive. Batch inputs (embeddings), and reuse cached embeddings.
- Keep prompts deterministic where possible for caching. Record prompt versions and model names in cache keys.
- Use safe parsing strategies for model outputs (structured-output pydantic models or schema validation) and fail fast on invalid structured output.

## Mapping to this repo (concrete next steps)

- Add a small caching decorator around LLM/embedding calls (see `services/openaiService.js` for the JS pattern; mirror in Python worker code where embeddings are produced).
- Add a Prometheus metric for `llm_latency` and `embedding_cache_hit` in the worker that creates vectors.
- Create a small pytest integration that runs a mocked embedding pipeline: upload -> chunk -> embed -> store.

Appendix: small utilities

Hash helper for stable cache keys:

```python
import hashlib

def sha256_hex(obj: bytes | str) -> str:
    if isinstance(obj, str):
        obj = obj.encode('utf-8')
    return hashlib.sha256(obj).hexdigest()
```

LRU cache caution

Use `functools.lru_cache` only for pure, deterministic functions that run in the same process — cross-process persistent caches (Redis) are recommended for real deployments.

If you want, I will open a PR that implements:

- A small Redis-backed caching helper for deterministic LLM/embedding calls (with TTL and namespace).
- A pytest integration that covers the embedding pipeline using a mocked LLM and ensures cache hits are counted.
