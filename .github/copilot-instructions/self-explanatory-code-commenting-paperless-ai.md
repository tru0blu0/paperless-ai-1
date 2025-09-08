---
description: "Self-explanatory code commenting for paperless-ai: AI/ML, cloud, automation."
applyTo: "**"
---

# Paperless-AI Code Commenting

- Write code that is self-explanatory and easy to review by both humans and AI agents.
- Only comment on "why", not "what"—let variable names and structure tell the story.
- Document complex logic, AI/ML model decisions, or non-obvious cloud interactions.
- Always docstring public APIs and functions.
- Annotate hacks, workarounds, or AI/LLM prompt templates clearly.
- Use TODO, FIXME, SECURITY, PERFORMANCE annotations as needed.

## Example

```python
def redact_pii(text: str) -> str:
    """
    Remove personally identifiable information (PII) from text.
    Uses regexes tuned for US document formats.
    """
    # ...implementation...
```
