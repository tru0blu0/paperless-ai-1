---
applyTo: "*"
description: "Security/OWASP best practices for paperless-ai: document automation, AI, cloud."
---

# Paperless-AI Security & OWASP Top 10

- Handle all document and user data as untrusted; sanitize and validate all inputs.
- Use the principle of least privilege for all cloud/service credentials (GCP, Vertex, Gemini).
- Never hardcode secrets; use GCP Secret Manager and GitHub secrets.
- Enforce HTTPS for all APIs and service calls (including GCP/Vertex endpoints).
- Use parameterized queries and ORM for all DB access—never raw SQL.
- Validate all file uploads for type, size, and path traversal.
- Run Bandit (Python) and Trivy (Docker) on every CI run.
- Set up automated dependency vulnerability scanning.
- Always patch and update dependencies promptly.
- Ensure logging does not leak sensitive info.
- Use environment-specific configuration, never commit prod keys/config.

## Example: Secure Use of Vertex AI

```python
import os
from google.cloud import aiplatform

aiplatform.init(
    project=os.environ["GCP_PROJECT"],
    location=os.environ["GCP_REGION"],
    credentials='auto'  # Use Workload Identity/OIDC, not static creds
)
```
