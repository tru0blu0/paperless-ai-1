---
applyTo: "*"
description: "Performance best practices for paperless-ai: AI, Python, cloud, containers."
---

# Paperless-AI Performance Optimization Guide

- Always measure before optimizing (profile with cProfile, py-spy, or GCP Profiler).
- Use efficient, idiomatic Python (built-ins, comprehensions, vectorization with numpy/pandas).
- Batch API calls to GCP/Vertex/Gemini when possible.
- Cache expensive operations (e.g., LLM calls, document parsing) using functools.lru_cache or Redis.
- Avoid memory leaks: clean up large objects, close files/connections.
- Use multi-threading/async for I/O, multiprocessing for CPU-bound.
- Paginate and stream large document datasets.
- Run load and latency tests for critical endpoints and document automation.
- Monitor performance in prod (GCP Monitoring, custom metrics).

## Example: Caching LLM Results

```python
from functools import lru_cache

@lru_cache(maxsize=128)
def run_gemini_prompt(doc_hash: str, prompt: str) -> str:
    # Call Gemini API, return response.
    ...
```
