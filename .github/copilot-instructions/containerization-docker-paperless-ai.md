---
applyTo: "**/Dockerfile,**/docker-compose*.yml"
description: "Docker/container best practices for paperless-ai: Python, AI/ML, cloud-native."
---

# Paperless-AI Docker/Container Best Practices

- Use multi-stage builds to keep images small and secure.
- Always pin base image versions (e.g., python:3.11-slim).
- Never include secrets in images or ENV; use runtime secrets via mounts or environment.
- Use non-root user for app runtime.
- Add a comprehensive `.dockerignore`.
- Include a HEALTHCHECK instruction.
- Expose only necessary ports.
- Set CPU/memory limits in Docker Compose/K8s.
- Scan images with Trivy and hadolint as part of CI.
- Document build/run commands in README.

## Example: Minimal Dockerfile

```Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY src/ ./src/
USER nobody
EXPOSE 8000
HEALTHCHECK CMD curl --fail http://localhost:8000/health || exit 1
CMD ["python", "-m", "paperlessai"]
```
