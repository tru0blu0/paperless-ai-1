MOVE TO: instructions/self-explanatory-code-commenting-paperless-ai.md
---
description: "Self-explanatory code commenting for paperless-ai: AI/ML, cloud, automation."
applyTo: "**"
---

# Self-explanatory code commenting — paperless-ai

Purpose: make code easy to read and safe to share with reviewers and AI tools. The guidance below is pragmatic and tuned for this repository (Python + Node + LLM prompt assets). Follow these rules when adding or editing code, prompt templates, or documentation.

Key principles

- Comment the why, not the what. Good names + small functions explain the what.
- Prefer clear code over clever comments. Refactor if comments feel like a contract for confusing code.
- Document intent, assumptions, side-effects, security considerations, and public API semantics.
- Keep comments and docstrings concise, grammatically correct, and actionable.

Docstrings & comments (Python)

- Use triple-double-quoted docstrings per PEP 257 for modules, public functions, classes, and complex private helpers when needed.
- Start with a one-line summary (<= 80 chars). Add a blank line and a short description when more detail is required.
- Include Args/Returns/Raises sections for non-trivial functions. Prefer type annotations in signatures; repeat only unstable or implicit types in the docstring.
- Keep top-level script execution behind `if __name__ == '__main__':` and keep module import-time side-effects small.

Example (Python):

```python
def extract_text(page_bytes: bytes) -> str:
        """Extract text from a single PDF page.

        This uses the project's fast-path OCR model when a pre-extracted text layer
        is missing. The caller is responsible for caching at a higher level.

        Args:
                page_bytes: PDF page bytes.

        Returns:
                Extracted Unicode text.

        Notes:
                This function avoids network calls; use the async wrapper for remote
                OCR services.
        """
        ...
```

JSDoc / JavaScript conventions

- For public JS/Node APIs add short JSDoc comments describing parameters, return values and side effects; keep examples for complex behavior.
- Use consistent style with the rest of the file (see `eslint.config.mjs`).

Prompt/template commenting (LLM assets)

- Treat prompts as code: explain intent, expected inputs/outputs, and safety constraints.
- Mark placeholders explicitly: use {{VAR_NAME}} or <<VAR_NAME>> consistently and document expected type/format.
- Never include secrets, keys, or real PII in prompt examples. If you must show a placeholder example, redact or canonicalize values (e.g., `EMAIL_REDACTED@example.com`).

Example prompt header:

````text
<!--
Intent: summarize OCRed receipts into canonical fields.
Inputs:
    - {{ocr_text}}: raw OCR string (must be pre-sanitized)
Outputs:
    - JSON with keys: vendor, date (YYYY-MM-DD), total (float)
Notes:
    - DO NOT include API keys or personal data in examples; run sanitizer on any stored prompt text.
-->

Summarize the receipt below into JSON:

{{ocr_text}}
````

Machine-friendly annotations and TODOs

- Use structured tags so automation can find and act on them:
  - TODO: `GH-123` or `https://github.com/<owner>/<repo>/issues/123` — short reason
  - FIXME: `short reason`
  - SECURITY: `reason and mitigation` (e.g., `rotate key, move to KeyVault`)
  - PERF: `observation and proposed approach`
- Example: `# TODO: GH-123 - replace regex with PDF-native parser when available`.
- Keep tags searchable and include an issue/PR reference when possible so CI can reconcile open todos.

Sensitive content and sanitizer

- Do not commit secrets, credentials, or real PII. The repo includes `scripts/sanitizer.py` which redacts tokens/keys/addresses from instructions and examples — rely on it for CI scans but avoid committing secrets in the first place.
- If a code comment must document a secret-handling decision, do so generically and reference the key rotation or secret store (e.g. `# SECURITY: Secrets are stored in KeyVault; do not hardcode.`).

Review checklist for code & prompt changes

- [ ] Is the function/class purpose described in a one-line docstring?
- [ ] Are public APIs typed (annotations or JSDoc) and documented?
- [ ] Does the comment explain intent/assumptions rather than re-state the code?
- [ ] Are prompt placeholders documented and sanitized in examples?
- [ ] Any TODO/FIXME includes an issue/PR link when possible.
- [ ] No secrets or real PII in the change set.

Automation notes for maintainers

- The repo validator expects front-matter in instruction files; follow the existing pattern for `.chatmode.md` / `.prompt.md` assets.
- The README generator and prompt-validator parse top-of-file comments and front-matter. Avoid embedding YAML-looking blocks inside comments unless intentionally part of the prompt payload.
- Tests should not rely on network calls at import time — prefer injectable clients/mocks.

Small examples (quick reference)

Python inline comment:

```python
# Use a short-lived cache here to avoid repeated OCR of the same page.
cache.set(key, value, ttl=60)
```

JS example (JSDoc):

```js
/**
 * Normalize document metadata.
 * @param {{title: string, date?: string}} meta
 * @returns {{title: string, date: string}}
 */
function normalizeMeta(meta) {
    // Implementation...
}
```

Prompt placeholder example:

````text
// Input: {{raw_text}} (string) — caller must run sanitizer before passing.
Extract key fields from: {{raw_text}}
````

Closing notes

- Prefer small, well-named functions and clear docstrings over long explanatory comments.
- If you find a file with many explanatory comments, prefer refactoring or adding tests that document the behavior instead of expanding comments.
- When in doubt about whether something should be in a comment, ask: "Will a future reader (or an AI extractor) understand the code without this comment?" If not, keep it and make it specific and actionable.

Related resources

- PEP 257 (docstrings), Google Python Style Guide (comments & TODO conventions), local `scripts/sanitizer.py` and `scripts/prompt_validator.py` (CI tooling to scan prompts).

---
End of guidance.
