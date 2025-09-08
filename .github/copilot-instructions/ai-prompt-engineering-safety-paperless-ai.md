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
