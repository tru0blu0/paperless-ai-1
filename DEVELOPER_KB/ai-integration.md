## AI Integration Knowledge Base — Paperless-AI

This document is the canonical developer KB for Paperless-AI's AI integrations (OpenAI, Azure OpenAI, Ollama, and local inference). It collects authoritative docs, repo-specific guidance, prompt templates, robust parsing patterns, and suggested low-risk PRs.

### Quick summary

- Purpose: reduce integration drift, improve reliability, and provide safe, repeatable patterns for prompts, JSON extraction, caching, and provider selection.
- Location: `services/*` (OpenAI/Ollama/Azure), `config/config.js`, `routes/setup.js`, `services/aiServiceFactory.js`, `services/ragService.js`.

### Contract (recorded)

- Input: raw document text (string, may be OCR output) and optional existing tags.
- Output: JSON matching repo schema (see example below). Should include tags, correspondent, metadata, confidence, and token metrics when available.
- Error modes: provider auth error, rate-limit, timeout, malformed JSON, excessive tokens.
- Success criteria: parsable JSON, fields present or null, no extraneous text.

### Canonical env vars and config

- OPENAI_API_KEY — OpenAI API key
- AZURE_API_KEY, AZURE_ENDPOINT, AZURE_DEPLOYMENT_NAME, AZURE_API_VERSION — Azure OpenAI
- OLLAMA_API_URL, OLLAMA_MODEL — Ollama local server
- AI_PROVIDER — one of `openai` | `azure` | `ollama` | `manual`
- Example `.env` snippet:

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk_...
AZURE_API_KEY=
AZURE_ENDPOINT=
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=ggml-gpt-4o
```

### Authoritative docs & selected references (bookmark)

- OpenAI Prompt Engineering Guide — <https://platform.openai.com/docs/guides/prompt-engineering>
- OpenAI Node SDK (official) — <https://github.com/openai/openai-node>
- OpenAI Cookbook (recipes) — <https://github.com/openai/openai-cookbook>
- Azure OpenAI quickstarts & best practices — Microsoft Learn (search: "Azure OpenAI quickstart JavaScript")
- Ollama repo & docs — <https://github.com/ollama/ollama>  (useful examples for local API)
- tiktoken / tokenization — <https://github.com/openai/tiktoken>
- Redis/node-redis (caching patterns) — <https://github.com/redis/node-redis>

### Repo-specific mapping

- `services/openaiService.js` — OpenAI client usage and some Ollama compatibility paths. Add strict JSON enforcement + caching here.
- `services/ollamaService.js` — Local LLM usage. Ollama does not return token metrics reliably; handle accordingly.
- `services/azureService.js`, `services/manualService.js`, `services/chatService.js` — Azure patterns (baseURL formatting, api-version query param).
- `services/aiServiceFactory.js` — centralized provider selection; keep interface stable: analyzeDocument(document, opts) -> { resultJson, tokens, provider }
- `services/ragService.js` — RAG orchestration, embedding calls, caching hooks.

### Prompt templates & engineering notes

Use a two-step approach for robust JSON extraction: (1) strict system instruction that enforces JSON-only output and provides a schema; (2) user content with the document.

System prompt (canonical):

```
You are a JSON-output assistant. For every input produce a single JSON object only. Follow this schema exactly:
{
  "tags": ["string"],
  "correspondent": { "name": "string|null", "email": "string|null" },
  "metadata": { "date": "string|null", "total": number|null },
  "summary": "string|null",
  "confidence": number
}
Do NOT output explanations, markdown, or any extra text. If a field is unknown, set it to null or an empty list.
```

User prompt (canonical):

```
Analyze the document below delimited by triple backticks. Extract tags, correspondent, date, total amounts, a short one-sentence summary, and a confidence score (0-1). Output MUST be valid JSON only.
Document: ```<DOCUMENT TEXT>```
```

Retry / stricter pass (if parsing fails):

- System: "You failed to return valid JSON earlier. Now you MUST return ONLY JSON matching the schema. No other text. If impossible, return {}."

### Robust JSON parsing & sanitizer (implementation notes)

1. Try JSON.parse(response).
2. If it fails, strip surrounding non-JSON text, locate the largest balanced `{...}` substring by bracket counting, attempt parse.
3. If still fails, call LLM again with the stricter retry prompt above.
4. As a last resort, mark document as `needs_review` and return a minimal JSON with that flag.

Place helper in `services/utils/llmHelpers.js` and call from `openaiService.js` and `ollamaService.js`.

### Caching & performance (recommended pattern)

- Use Redis (or in-memory cache for dev) to memoize embedding and LLM responses. Key = hash(provider + model + prompt + options).
- TTL: configurable per endpoint (e.g., embeddings: 30d; analysis responses: 7d).
- Metric: increment `cache.hit` / `cache.miss` counters in `ragService.js`.

Example decorator summary (pseudo):

```
async function cachedCall(key, ttl, fn) {
  const v = await redis.get(key);
  if (v) { metrics.inc('cache.hit'); return JSON.parse(v); }
  const res = await fn();
  await redis.set(key, JSON.stringify(res), { EX: ttl });
  metrics.inc('cache.miss');
  return res;
}
```

### Token-budget handling

- Use `tiktoken` to estimate tokens. For long docs: chunk semantically, summarize each chunk, then run final extract prompt with top-N chunks + summary.

### Low-risk PRs to land (recommended order)

1. Add this KB file to `DEVELOPER_KB/ai-integration.md` (this PR).
2. Add `services/utils/llmHelpers.js` with `strictJsonParse(response)` and sanitizer + tests.
3. Add a Redis caching wrapper and integrate into `services/openaiService.js` for embeddings and analysis calls.
4. Add unit tests for JSON sanitizer and cache behavior.

### Tests & verification

- Unit test: sanitizer returns parsed JSON for common malformed outputs.
- Integration test (mocked provider): analyzeDocument returns normalized JSON and logs token metrics.

### Notes & ops

- Monitor tokens/cost in `views/dashboard.ejs` — ensure reported metrics come from provider responses (OpenAI returns tokens; Ollama does not).
- Keep provider selection interface stable in `AIServiceFactory.getService()`.

---
If you want, I can now open a PR with this file and create follow-up PRs for the helper + caching changes. The next recommended step is to open this KB PR.
