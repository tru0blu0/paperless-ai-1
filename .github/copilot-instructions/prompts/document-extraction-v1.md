---
name: "document-extraction-v1"
version: "1.0.0"
risk-level: "medium"
owner: "ai-team@example.com"
description: "Extract structured metadata from sanitized document text"
sanitization: "required"
---

Prompt:

Extract the following fields from the sanitized document text provided. Output MUST be valid JSON matching the schema: {"title": "string", "date": "string|null", "total": "number|null", "vendor": "string|null"}. If a value is not present, return null.

Input:

`{{sanitized_text}}`

Output example:

{
  "title": "Invoice 1234",
  "date": "2025-01-10",
  "total": 123.45,
  "vendor": "Example Corp"
}
