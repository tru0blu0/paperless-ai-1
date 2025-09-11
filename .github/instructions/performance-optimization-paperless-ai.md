MOVE TO: instructions/performance-optimization-paperless-ai.md
---
applyTo: "*"
description: "Performance best practices for paperless-ai: AI, Python, cloud, containers."
---
# Paperless-AI Performance Optimization Guide

This document collects practical, repo-aligned performance guidance for Paperless-AI. It is intentionally pragmatic: measure first, then apply targeted fixes. Where relevant, examples include patterns that map to this codebase (look at `services/openaiService.js`, `services/ragService.js`, `services/aiServiceFactory.js`, and `services/paperlessService.js`).

Top-level checklist (quick):

- Measure: profile requests and long-running jobs before changing code.
- Cache: LLM/embedding results + parsed document outputs.
- Batch & rate-limit: group external API calls and protect with rate-limiters.
- Offload: move heavy/async work to background workers.
- Stream & paginate: avoid loading whole documents into memory.
- Monitor & test: add metrics, alerts, and load tests.

## Measure first

Tools: node --prof / clinic.js / 0x for Node; py-spy, cProfile, heapy for Python; pprof / Cloud Profiler for GCP.

Sample quick checks:

- Measure endpoint latency with wrk/k6 or curl + time.
- Use flamegraphs to find CPU hotspots (clinic flame or py-spy).

## Caching (high impact)

Cache LLM outputs and embeddings. LLM calls are often the dominant cost.

Use a persistent cache (Redis, DynamoDB, or a relational DB) keyed by a stable prompt hash + model + options.

Prefer TTLs and cache invalidation policies (e.g., separate short/long caches for conversational vs. document-extraction prompts).

Node example (Redis) — pattern for `services/openaiService.js`:

```js
// pseudo: cache wrapper for LLM responses
const crypto = require('crypto');
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

async function llmCacheKey(model, prompt, opts) {
    const hash = crypto.createHash('sha256')
        .update(JSON.stringify({model, prompt, opts}))
        .digest('hex');
    return `llm:${hash}`;
}

async function cachedCall(model, prompt, opts, callFn) {
    const key = await llmCacheKey(model, prompt, opts);
    const cached = await client.get(key);
    if (cached) return JSON.parse(cached);
    const res = await callFn();
    await client.setEx(key, 60 * 60, JSON.stringify(res)); // 1h TTL
    return res;
}
```

## Batching & concurrency control

Batch small requests together (embeddings, search queries) to reduce round trips. Many embedding APIs accept arrays.

For streaming clients, use concurrency pools (p-limit / Bottleneck) to bound parallel external calls and avoid rate limit spikes.

Example: batch embeddings (Node) — call the provider with N inputs in one request instead of N small requests.

## Background workers and job queues

Move CPU-bound OCR, PDF parsing, and large-document vectorization to background workers.

Use BullMQ / Bee-Queue / RabbitMQ / Celery (for Python) with retries and idempotency keys.

Add a small job status API in the app so UI can poll for results rather than blocking HTTP requests.

## Streaming & memory usage

Stream files from the client directly to object storage (S3/GCS) and process in chunks. Avoid buffering whole files in memory.

When extracting text or generating embeddings, chunk documents to a fixed size (e.g., 1k–4k tokens) with overlap to keep context.

## Embeddings & vector DBs

Cache embeddings by document hash; only recompute embeddings for changed content.

Choose a vector DB that matches your scale and QoS: FAISS (self-hosted), Milvus, Weaviate, Pinecone, or RedisVector.

When serving retrieval-augmented generation (RAG), do an initial lightweight filter (metadata) before vector nearest-neighbor search.

## Rate limits, retries, and backoff

Implement exponential backoff with jitter for external LLM and embedding calls.

Use circuit-breakers (e.g., Opossum in Node) to fail fast under prolonged upstream outages.

## Profiling & tracing

Add distributed tracing (OpenTelemetry) to trace user requests across web, worker, and external LLM calls.

Add critical custom metrics: LLM latency, LLM error rate, embedding cache hit rate, queue backlog, OCR job time.

## Container and infra tuning

Resource limits: set CPU/memory requests & limits for containers. Avoid unlimited containers.

Use multi-stage Dockerfiles and keep base images small.

For local development, disable heavy background workers to avoid resource contention.

## Testing & load validation

Create small benchmark suites:

- Unit-level test for batching logic and cache correctness.
- Integration smoke tests for worker jobs (fast path).
- Load tests with k6 or locust on critical endpoints (upload, extract, chat).

## Logging, monitoring & alerts

Export metrics to Prometheus/GCP Monitoring. Use Grafana for dashboards (LLM latency, cost per request).

Track cost metrics (LLM tokens per request, embedding usage).

## Language-specific tips

Node (this repo's server):

- Use streaming APIs (SSE / Response streaming) to send partial results to clients.
- Avoid synchronous blocking work on the main event loop — offload heavy work to workers or child processes.

Python (scripts/workers):

- For CPU-bound tasks (OCR, heavy parsing), prefer multiprocessing or a separate worker process pool.
- Use py-spy/objgraph to find leaks.

## Quick wins mapped to this repo

- Add caching around LLM and embedding calls in `services/openaiService.js` and `services/ollamaService.js`.
- Convert synchronous document parsing paths into background jobs via a `setupService`/`manualService` worker.
- Instrument `services/ragService.js` to report embedding cache hit/miss and query latency.

## Example: small Node middleware to measure LLM call latency and increment a metric

```js
// pseudo-metrics wrapper
async function instrumentedLLMCall(model, prompt, opts, callFn, metrics) {
    const start = Date.now();
    try {
        const res = await callFn();
        metrics.histogram('llm.latency').observe(Date.now() - start);
        return res;
    } catch (err) {
        metrics.increment('llm.errors');
        throw err;
    }
}
```

## Security & cost guardrails

Enforce token / cost limits per-request (e.g., hard maximum tokens for LLM calls).

Add API quotas and per-user rate limits to avoid noisy neighbors.

Further reading and external tools to consider

- OpenTelemetry + Prometheus + Grafana for metrics and tracing.
- Redis for caching and as a lightweight job queue for ephemeral jobs.
- BullMQ / RabbitMQ / Celery for robust job processing.
- py-spy / clinic.js / 0x for flamegraphs.

Appendix: minimal example — Python lru_cache for deterministic prompt functions

```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def deterministic_prompt_result(prompt_hash: str, model: str) -> str:
        # Only use for pure functions (no user-specific secrets, no streaming)
        return run_llm(prompt_hash, model)
```

Notes and next steps

- Add a single integration: caching decorator around LLM calls in `services/openaiService.js` (low-risk, high-impact).
- Add simple Prometheus metrics for LLM latency and queue depth.

If you want, I can:

- Create a PR that implements Redis-based caching wrapper for `services/openaiService.js` and adds a metrics increment in `services/ragService.js`.
- Add a k6 load test script targeting the `/rag` and `/chat` endpoints.
