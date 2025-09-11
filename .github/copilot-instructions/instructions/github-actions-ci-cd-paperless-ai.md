MOVE TO: instructions/github-actions-ci-cd-paperless-ai.md
---
applyTo: ".github/workflows/*.yml"
description: "CI/CD standards for paperless-ai: secure, cloud-ready, Python/AI/ML workflows."
---

# Paperless-AI CI/CD (GitHub Actions) Best Practices

- Use descriptive, modular workflow names (e.g., build-ml.yml, deploy-gcp.yml).
- Always pin action versions (`actions/checkout@v4`, not `@latest`).
- Use OIDC for authenticating to GCP (no static credentials/secrets).
- Separate jobs: lint, test, build, deploy (do not mix prod deploy with test).
- Run all Python/ML tests (pytest or unittest) and collect coverage.
- Integrate security scanning (Bandit for Python, Trivy for Docker, secret scanning).
- Deploy containers to GCP or other cloud via approved, reviewed workflows only.
- Use artifacts to share build/test outputs between jobs.
- Set up environment protection rules for prod deploys (manual approval, reviewers).
- Cache dependencies (pip, poetry, npm) for faster builds.
- Use matrix strategies for multi-version Python or multi-arch containers.

## Security

- Never expose or echo secrets in logs.
- Use `permissions:` blocks to default to least privilege.
- Enable and monitor secret scanning, dependency scanning, and code scanning.

## Example (Python OIDC to GCP)

```yaml
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: google-github-actions/auth@v2
        with:
          token_format: "access_token"
          workload_identity_provider: ${{ secrets.GCP_WORKLOAD_IDENTITY_PROVIDER }}
          service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
      - run: gcloud config set project ${{ secrets.GCP_PROJECT }}
      # ... deployment steps ...
```
