MOVE TO: instructions/ai-prompt-engineering-safety-paperless-ai.md
---
applyTo: ["*"]
description: "Best practices for AI prompt engineering, safety, bias mitigation, and responsible usage in paperless-ai (Python, GCP, Vertex AI, Gemini, secure document automation)."
---

# Paperless-AI: Prompt Engineering & Safety Best Practices

## Mission

Ensure all prompts (for LLMs, Copilot agents, and integrations like Vertex AI/Gemini) are clear, safe, bias-mitigated, and responsible—especially when handling document content, automation, or user-facing AI features.

## Fundamentals

- State the task clearly, include document context and user goals.
- Specify expected format (JSON/markdown, etc.) and any compliance/security requirements.
- Reference paperless-ai’s use of Python, GCP, Vertex AI, and Gemini APIs when relevant.

## Safety & Bias Mitigation

- Never echo or process sensitive data unless sanitized; redact PII by default.
- Perform red-teaming/adversarial testing for prompts involving document extraction or user content.
- Use inclusive, neutral language and avoid assumptions about document authorship or content.

## Responsible AI Usage

- Log all prompt inputs/outputs for auditability (exclude sensitive data).
- Document the intent and limitations of each prompt.
- Disclose AI usage to end users and provide opt-out where feasible.

## Security

- Never interpolate untrusted document/user data directly into prompts.
- Use input validation and output moderation (e.g., Google AI/Gemini moderation APIs).
- Follow GCP/Vertex AI security and privacy best practices for document and model usage.

## Testing & Validation

- Write unit tests for custom prompt templates and LLM workflows.
- Validate outputs for harmful, biased, or non-compliant content.
- Version and document prompt changes.

## Paperless-AI Prompt Design Checklist

- [ ] Task and context clearly stated
- [ ] Format/structure specified (JSON/markdown, etc.)
- [ ] Output sanitized for PII
- [ ] Safety, bias, and compliance validated
- [ ] Uses paperless-ai terminology and document types

---

References:

- [Google Responsible AI](https://ai.google/responsibility/)
- [Vertex AI Prompt Design](https://cloud.google.com/vertex-ai/docs/generative-ai/text/prompts)
- [OpenAI Prompt Engineering](https://platform.openai.com/docs/guides/prompt-engineering)
- [OWASP AI Security](https://owasp.org/www-project-top-10-for-large-language-model-applications/)

## Prompt Versioning and Governance

- Store canonical prompt templates in a single folder (e.g. `.github/copilot-instructions/prompts/` or `/prompts/`).
- Each prompt template MUST include a YAML front-matter with at least: `name`, `version` (semver or date), `risk-level` (low|medium|high), and `owner`.
- Keep a CHANGELOG.md for prompt updates and require a short justification in PRs that modify prompt templates.

Example front-matter (required):

---

name: "document-extraction-v1"
version: "1.0.0"
risk-level: "medium"
owner: "<ai-team@example.com>"
---


## Redaction & Sanitization (operational)

- Always run a sanitization/redaction pipeline before sending document text to any LLM. Redaction must be configurable and pluggable: regex-based + deterministic named-entity detections.
- Minimal redaction rules (examples):
	- Email: <EMAIL_REDACTED>
	- Phone: <PHONE_REDACTED>
	- SSN / National ID patterns: <PII_REDACTED>
	- Credit card numbers: <CC_REDACTED>

Pseudocode example (Python-like):

```python
def sanitize_text(text: str) -> str:
+    # 1) Normalize whitespace and unicode
+    text = normalize_unicode(text)
+    # 2) Replace sensitive patterns with stable placeholders
+    text = re.sub(EMAIL_REGEX, '<EMAIL_REDACTED>', text)
+    text = re.sub(PHONE_REGEX, '<PHONE_REDACTED>', text)
+    text = re.sub(SSN_REGEX, '<PII_REDACTED>', text)
+    # 3) Optional NER-based redaction for names/addresses
+    entities = ner_extract(text)
+    for ent in entities:
+        if ent.label in ('PERSON','ADDRESS'):
+            text = text.replace(ent.text, f'<{ent.label}_REDACTED>')
+    return text
+```
+
+
## Logging & Retention for Prompts
+
+
- Log prompt metadata, timestamp, prompt template id/version, caller id, and model id, but never persist the full raw document text unencrypted. Use masked or hashed document identifiers (e.g., sha256 of sanitized text) for correlation.
- Define retention: e.g., prompt metadata + masked outputs retained 90 days, raw sanitized audit records retained 365 days only with restricted access; raw unsanitized documents must not be logged.
+
