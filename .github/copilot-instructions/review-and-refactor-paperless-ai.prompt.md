---
name: review-and-refactor
version: 1.0
risk-level: medium
owner: "engineering-team@example.com"
---

```prompt
---
mode: "agent"
description: "Perform a structured review and refactor of code and workflows in paperless-ai, producing a human-readable report and a machine-readable action plan (YAML) with prioritized refactor tasks, tests to add, risks, and approval gates."
---

# Review & Refactor Prompt — Paperless-AI

Goal: Given a target area (file(s), module, or the whole repo) produce:
- A concise human-readable review report (findings, recommendations, and priority list).
- A machine-readable YAML plan that breaks the work into atomic refactor tasks suitable for automated triage and PR creation.

Inputs (provide when invoking):
- target: file path(s) or module name or "repo"
- focus: one-line scope (e.g., "improve test coverage for services/*", "refactor prompt handling for safety")
- constraints: runtime, backward-compatibility, test budgets, or timelines
- stakeholders: list of owner emails or teams
- priority: low|medium|high

Output contract (strict):
1) Human-readable report (markdown) with header "# Review Report — <target>". Include: summary, high-priority findings, recommended refactors, tests to add, and acceptance criteria.

2) Machine-readable YAML plan fenced as ```yaml using the schema below.

YAML schema (required):

review_plan:
	target: string
	focus: string
	summary: string
	priority: string         # low|medium|high
	stakeholders:
		- string
	findings:
		- id: string
			severity: string     # low|medium|high
			description: string
			evidence: string     # short code excerpt or file:path
	tasks:
		- id: string
			title: string
			description: string
			file_mods:
				- path: string
					intent: string
			owner: string
			estimate_hours: int
			tests_added:
				- string
			approval_required: boolean
			acceptance_criteria:
				- string
	risks:
		- id: string
			severity: string
			description: string
			mitigation: string
	rollback:
		- step: string
			description: string
	generated_by: string
	generated_at: string

Quality rules & heuristics:
- Prefer small, well-scoped tasks (1–3 files) and include test additions for each behavior change.
- Mark approval_required: true for CI, deployment, secret, or schema/database changes.
- Provide code evidence (file:line or short snippet) for each finding to make triage fast.
- For refactors touching public APIs, include a compatibility test and a migration plan.

Example brief output (human summary + YAML):

Human report header:

# Review Report — services/

- Summary: "Reduce coupling in `services/*` and add unit tests for core flows."
- High priority: missing unit tests for `paperlessService.updateDocument` (evidence: services/paperlessService.js:1223-1251)

```yaml
review_plan:
	target: services/
	focus: "increase test coverage and decouple paperlessService"
	summary: "Add unit tests and split responsibilities between controller and service"
	priority: high
	stakeholders:
		- engineering-team@example.com
	findings:
		- id: f1
			severity: high
			description: "Complex updateDocument with multiple responsibilities"
			evidence: "services/paperlessService.js:1223-1251"
	tasks:
		- id: t1
			title: Add unit tests for updateDocument
			description: Add pytest unit tests covering date parsing and custom_fields behavior
			file_mods:
				- path: .github/copilot-instructions/tests/test_paperless_service_update.py
					intent: "New tests covering edge cases"
			owner: engineering-team@example.com
			estimate_hours: 4
			tests_added:
				- test_update_document_date_parsing
			approval_required: false
			acceptance_criteria:
				- "New tests pass locally and in CI"
	risks: []
	rollback:
		- step: revert-pr
			description: "Revert PR if tests fail in CI or behavior regresses"
	generated_by: review-and-refactor-prompt
	generated_at: "2025-09-09T00:00:00Z"
```

Deliverable rules (strict):
- The response must contain exactly two top-level sections in this order: 1) Human-readable review report, 2) YAML plan fenced as ```yaml.
- If required inputs are missing, ask one concise clarifying question.

When ready, produce only the two outputs described above and nothing else.

```
