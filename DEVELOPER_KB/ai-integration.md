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
- CUSTOM_BASE_URL, CUSTOM_API_KEY, CUSTOM_MODEL — Custom OpenAI-compatible API
- AI_PROVIDER — one of `openai` | `azure` | `ollama` | `custom`
- Example `.env` snippet:

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk_...
AZURE_API_KEY=
AZURE_ENDPOINT=
AZURE_DEPLOYMENT_NAME=
AZURE_API_VERSION=2023-05-15
OLLAMA_API_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
CUSTOM_BASE_URL=
CUSTOM_API_KEY=
CUSTOM_MODEL=
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
- `services/azureService.js` — Azure patterns (baseURL formatting, api-version query param).
- `services/customService.js` — Custom OpenAI-compatible API endpoints.
- `services/manualService.js` — Manual processing service with multi-provider support.
- `services/aiServiceFactory.js` — centralized provider selection; keep interface stable: analyzeDocument(document, opts) -> { resultJson, tokens, provider }
- `services/ragService.js` — RAG orchestration, embedding calls, caching hooks.

### Prompt templates & engineering notes

Use a two-step approach for robust JSON extraction: (1) strict system instruction that enforces JSON-only output and provides a schema; (2) user content with the document.

System prompt (canonical):

```
You are a JSON-output assistant. For every input produce a single JSON object only. Follow this schema exactly:
{
  "title": "string",
  "correspondent": "string",
  "tags": ["string"],
  "document_type": "string",
  "document_date": "string",
  "language": "string",
  "custom_fields": { "field_name": "value" }
}
Do NOT output explanations, markdown, or any extra text. If a field is unknown, set it to null or an empty list.
```

User prompt (canonical):

```
Analyze the document below delimited by triple backticks. Extract title, correspondent, tags, document_type, document_date, language, and any custom_fields. Output MUST be valid JSON only.
Document: ```<DOCUMENT TEXT>```
```

Retry / stricter pass (if parsing fails):

- System: "You failed to return valid JSON earlier. Now you MUST return ONLY JSON matching the schema. No other text. If impossible, return {}."

### Robust JSON parsing & sanitizer (implementation notes)

1. Try JSON.parse(response).
2. If it fails, strip surrounding non-JSON text, locate the largest balanced `{...}` substring by bracket counting, attempt parse.
3. If still fails, call LLM again with the stricter retry prompt above.
4. As a last resort, mark document as `needs_review` and return a minimal JSON with that flag.

Place helper in `services/serviceUtils.js` (which already contains utilities like `calculateTokens`, `truncateToTokenLimit`, `writePromptToFile`) and call from `openaiService.js` and `ollamaService.js`. Consider adding a `strictJsonParse` function to this file.

### Caching & performance (current and recommended patterns)

**Current Implementation:**
- In-memory caching in `paperlessService.js` for tags and custom fields (3-second TTL)
- Thumbnail caching to `./public/images/` directory for document previews
- Simple Map-based cache with size and time-based invalidation

**Recommended Enhancements:**
- Use Redis (or extend in-memory cache) to memoize embedding and LLM responses. Key = hash(provider + model + prompt + options).
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

- Use `tiktoken` (already in serviceUtils.js) to estimate tokens with `calculateTokens()` and `truncateToTokenLimit()`. For long docs: chunk semantically, summarize each chunk, then run final extract prompt with top-N chunks + summary.

### Low-risk PRs to land (recommended order)

1. ✅ Add this KB file to `DEVELOPER_KB/ai-integration.md` (this PR).
2. Add `strictJsonParse(response)` sanitizer function to `services/serviceUtils.js` with tests.
3. Add a Redis caching wrapper and integrate into AI services for embeddings and analysis calls.
4. Add unit tests for JSON sanitizer and cache behavior.
5. Add comprehensive integration tests for all AI providers.

### Tests & verification

**Current Testing:**
- Ad-hoc test scripts: `test-restriction-service.js`, `test-updated-service.js` 
- Python tests in `.github/copilot-instructions/tests/` for utilities

**Recommended:**
- Unit test: sanitizer returns parsed JSON for common malformed outputs.
- Integration test (mocked provider): analyzeDocument returns normalized JSON and logs token metrics.
- Add Jest/Mocha test framework with proper test structure in `test/` directory.

### Error handling patterns

**Current Implementation:**
- Services throw errors that bubble up to route handlers
- Thumbnail caching uses try/catch with fallback behavior
- JSON parsing failures in response processing

**Recommended:**
- Implement retry mechanisms with exponential backoff for provider timeouts
- Add circuit breaker pattern for provider unavailability  
- Enhanced error categorization (auth, rate-limit, parsing, network)
- Graceful degradation when AI providers are unavailable

### Performance considerations

- Token usage monitoring via `tiktoken` library
- Document chunking for large files using `truncateToTokenLimit()`
- Asynchronous processing with proper timeout handling (30min for Ollama)
- Memory-efficient thumbnail caching to filesystem

### Configuration management

All AI provider configuration is centralized in `config/config.js`:
- Environment variable parsing with sensible defaults
- Provider-specific configuration objects (openai, azure, ollama, custom)
- Feature flags for AI restrictions and processing modes

### Debugging & troubleshooting

**Debug logging:**
- Enable debug logs with `[DEBUG]` prefix throughout services
- Token usage logging with timestamps in German locale
- Prompt and response logging to `./logs/prompt.txt` via `writePromptToFile()`

**Common issues:**
- Provider authentication failures → check API keys and endpoints
- JSON parsing errors → implement robust sanitizer with fallback
- Token limit exceeded → use `truncateToTokenLimit()` function
- Ollama connectivity → verify `OLLAMA_API_URL` and model availability
- Thumbnail caching → check `./public/images/` permissions

**Monitoring endpoints:**
- Service status checks available for each provider
- Token usage metrics displayed in dashboard
- Cache hit/miss statistics (when implemented)

### Notes & ops

- Monitor tokens/cost in `views/dashboard.ejs` — ensure reported metrics come from provider responses (OpenAI returns tokens; Ollama does not).
- Keep provider selection interface stable in `AIServiceFactory.getService()`.

---
If you want, I can now open a PR with this file and create follow-up PRs for the helper + caching changes. The next recommended step is to open this KB PR.
