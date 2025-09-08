---
description: "Python coding conventions for paperless-ai: AI/ML, cloud, and document automation"
applyTo: "**/*.py"
---

# Paperless-AI Python Coding and Documentation Guidelines

- Use descriptive function names, type hints, and docstrings (PEP 257).
- Prefer [dataclasses](https://docs.python.org/3/library/dataclasses.html) for document/data models.
- All code must be PEP 8 compliant; format with [Black](https://black.readthedocs.io/en/stable/).
- Document external dependencies and their role (esp. cloud/AI SDKs like google-cloud-aiplatform, google-generativeai).
- Write tests for all document parsing, LLM, and GCP integration logic (pytest recommended).
- Handle edge cases (empty docs, non-UTF8, corrupt files, API errors).
- Never hardcode secrets or credentials—use environment variables and GCP Secret Manager.
- Use logging, not print, for all operational code.
- Add comments explaining non-obvious business logic or AI/ML reasoning.

## Example

```python
def extract_entities(doc_bytes: bytes) -> list[str]:
    """
    Extract named entities from a document using Vertex AI.
    Args:
        doc_bytes (bytes): The document content in bytes.
    Returns:
        list[str]: List of extracted entity names.
    """
    # ...implementation...
```
