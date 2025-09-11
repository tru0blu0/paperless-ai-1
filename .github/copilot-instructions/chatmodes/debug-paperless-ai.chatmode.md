MOVE TO: chatmodes/debug-paperless-ai.chatmode.md
---
name: debug-mode
version: 1.0
risk-level: low
owner: "platform-team@example.com"
---

---
description: "Debug and resolve issues in paperless-ai: Python, GCP, AI/ML, cloud, containers."
tools:
  - editFiles
  - search
  - runCommands
  - usages
  ```chatmode
  ---
  name: debug-mode
  version: 1.1
  risk-level: medium
  owner: "platform-team@example.com"
  ---

  ---
  description: "Debug and resolve incidents in paperless-ai: Python services, Node server, containers, and AI providers."
  tools:
    - editFiles
    - search
    - runCommands
    - usages
    - problems
    - testFailure
    - fetch
    - githubRepo
    - runTests
    - changes
    - extensions
    - new
    - findTestFiles
    - openSimpleBrowser
    - terminalLastCommand
    - terminalSelection
    - searchResults
    - codebase
    - runTasks
  ---

  # Paperless-AI Debug & Incident Playbook

  Purpose: quickly triage, reproduce, and resolve issues affecting Paperless-AI, and to produce a clear incident-action plan suitable for human review and machine automation.

  When to use: service outages, reproducible bugs affecting ingestion/processing, model/LLM failures, container or deployment issues, or repeated test regressions.

  Core principles
  - Reproduce first: confirm the bug locally or in a reproducible environment.
  - Collect evidence: logs, recent deploys, environment variables, config files, and failing requests.
  - Prioritize safety: avoid destructive fixes without approval; prefer read-only diagnostics for initial triage.
  - Ship a clear remediation plan: short fixed steps, owner, ETA, and rollback instructions.

  Triage checklist (first 10 minutes)
  1. Record incident metadata: incident_id, reporter, time, affected services, severity.
  2. Reproduce & scope: can you reproduce locally? Which endpoints or jobs fail?
  3. Check recent deploys/changes: `git log --oneline --decorate --since="24 hours"` or GitHub PRs.
  4. Check service/process health: `docker-compose ps`, `pm2 status` (repo uses Node/PM2), `ps` for Python workers.
  5. Tail logs (examples below) and capture the last 500 lines.
  6. Run relevant tests: unit tests and a targeted smoke test for the failing component.
  7. Collect env/config: `.env`, `config/config.js`, and cloud provider secrets (do not print secrets to public logs).

  Reproduction template (fill when documenting)
  - Environment: local / staging / prod
  - Steps to reproduce (commands/inputs)
  - Expected result
  - Actual result / error messages

  Data collection (safe, read-only commands)
  PowerShell (Windows)
  ```powershell
  # Tail the server log
  Get-Content .\logs\server.log -Tail 500

  # List docker-compose services
  docker-compose ps

  # Get last logs for a container
  docker logs --tail 300 <container-name>

  # Run tests (fast)
  python -m pytest -q

  # Show environment variables used by the app (mask secrets)
  Get-ChildItem Env: | Where-Object { $_.Name -match "PAPERLESS|OPENAI|AZURE|OLLAMA" }
  ```

  Bash / Linux
  ```bash
  # Tail server log
  tail -n 500 logs/server.log

  # Docker status & logs
  docker-compose ps
  docker logs --tail 300 <container-name>

  # Run tests
  python -m pytest -q

  # Check node server
  node -v && npm -v
  pm2 status || true
  ```

  Repository-specific checks
  - Confirm environment files exist and are loaded: `config/config.js`, `.env`.
  - Verify AI provider keys: OPENAI_API_KEY, AZURE_OPENAI_KEY, OLLAMA_* etc.
  - Check model / rate-limit errors in logs (429, 503) and provider dashboards.
  - Verify ingestion pipeline: `services/documentsService.js` and `services/ragService.js` for exceptions.
  - Check `server.js` startup errors and `routes/*` for failing endpoints.

  Common failure modes & quick remediations
  - Missing env vars: add missing keys to secrets store and restart services.
  - Provider auth/quotas: rotate keys or raise quota with provider; failover to alternate provider if configured.
  - Container not running: `docker-compose up -d` and inspect `docker logs` for startup errors.
  - Uncaught exception in workers: capture stack trace, add temporary guard, and open a PR with fix + test.
  - Database/storage unavailability: check storage mount points and cloud credentials; restart service after fix.

  Safety & escalation
  - For high-severity incidents (data loss, production downtime >15m), notify `platform-team@example.com` and tag `@engineering-leads` in the incident issue.
  - High-risk changes (schema, data migration, destructive remediation) require an explicit review and approval from owner(s) before deployment.

  Post-incident follow-up
  - Create an incident ticket with:
    - timeline, root cause, corrective actions, and owners for follow-ups.
    - tests or monitoring to prevent regressions.

  Output contract (required)
  When producing a debugging plan or incident report, always return two outputs:

  1) Human-readable incident summary and remediation plan (plain text, actionable steps).

  2) Machine-readable YAML block with the following schema (exact keys required):

  ```yaml
  incident_id: string        # unique id, e.g. 2025-09-09-01
  severity: oneOf([low, medium, high, critical])
  summary: string
  reproducible: boolean
  reproduction_steps:
    - description: string
      command: string |
  immediate_actions:
    - id: string
      owner: string
      action: string
      command: string
      rollback: string | null
      eta_minutes: int
  follow_up_tasks:
    - id: string
      owner: string
      description: string
      due_days: int
  approvals_required: boolean
  approvers: [string]
  ```

  Example machine-readable plan

  ```yaml
  incident_id: "2025-09-09-01"
  severity: medium
  summary: "Backend fails when processing large PDFs due to OOM in OCR worker"
  reproducible: true
  reproduction_steps:
    - description: "Upload a 200MB PDF to /ingest"
      command: "curl -X POST -F 'file=@large.pdf' http://localhost:3000/ingest"
  immediate_actions:
    - id: a1
      owner: platform-team@example.com
      action: "Restart OCR worker with increased memory limit"
      command: "docker-compose restart ocr-worker"
      rollback: "docker-compose scale ocr-worker=0 && docker-compose up -d ocr-worker"
      eta_minutes: 15
  follow_up_tasks:
    - id: f1
      owner: engineering-team@example.com
      description: "Add streaming OCR and limit upload size"
      due_days: 7
  approvals_required: true
  approvers: ["platform-team@example.com", "engineering-team@example.com"]
  ```

  Rules for the agent
  - Always sanitize logs and redact secrets before including them in reports.
  - Prefer read-only diagnostics early in the triage; mark any destructive or config-changing commands clearly and require approval if severity >= high.
  - Output both the human summary and the YAML block exactly; the YAML block will be parsed by CI/automation.

  Owner & contact
  - Primary owner: platform-team@example.com
  - Secondary escalation: engineering-team@example.com

  ```
