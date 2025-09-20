MOVE TO: prompts/create-implementation-plan-paperless-ai.prompt.md
---
name: implementation-plan
version: 1.0
risk-level: low
owner: "docs-team@example.com"
---
```prompt
---
mode: "agent"
description: "Create clear, testable, machine-readable implementation plans (human + YAML) for features, refactors, or infra changes in paperless-ai. The plan must include phases, tasks, owners, estimates, tests, risk classification, approval gates, and rollback steps."
---

# Implementation Plan Prompt — Paperless-AI

Goal: Given a short feature description, produce (A) a concise human-readable plan and (B) a machine-readable YAML plan that automation and CI can consume.

Deliverable rule (required):

- The response MUST contain exactly two top-level sections in this order:
	1) Human-readable plan (markdown) with the header "# Implementation Plan — <feature_name>"
	2) Machine-readable YAML block fenced as ```yaml following the schema.


Inputs (provide when invoking):
- feature_name: short slug/title
- summary: 1–3 sentence description of the feature or change
- motivation: why this is needed (one paragraph)
- scope_in: list of files, modules, or directories in-scope
- constraints: any constraints (time, tokens, provider limits, backward compatibility)
- stakeholders: list of owner emails or teams
- priority: low/medium/high
- desired_delivery: date or sprint (optional)

Output contract (two parts):

1) Human-readable plan (markdown) with phases and acceptance criteria.

2) Machine-readable plan (YAML) with the exact schema below. The YAML must be valid and enclosed in a fenced block labeled ```yaml.

Machine-readable YAML schema (required fields):

plan:
	name: string                # feature_name
	summary: string
	motivation: string
	priority: string            # low|medium|high
	stakeholders:              # list of owners/team emails
		- string
	phases:                    # ordered list of phases
		- id: string
			title: string
			description: string
			tasks:
				- id: string
					description: string
					file_mods:            # optional explicit file paths to change
						- path: string
							intent: string    # short note about the edit
					owner: string         # owner email/team
					estimate_hours: int
					tests:                # tests to add/run (names or commands)
						- string
					approval_required: boolean
					approval_notes: string # when approval is needed
			acceptance_criteria:     # list of pass criteria for the phase
				- string
	risks:
		- id: string
			severity: string         # low|medium|high
			description: string
			mitigation: string
	rollback:
		- step: string
			description: string
	artifacts:
		- path: string            # files created/updated
	generated_by: string       # prompt/tool name
	generated_at: string       # ISO timestamp

Quality rules & heuristics (enforce when generating):
- Break work into small, testable tasks (<= 1–3 files per task when possible).
- For any task that modifies CI, Docker, deployment, or secrets, set approval_required: true and add a human owner.
- Include at least one automated test and one rollback step per phase that changes production-facing behavior.
- Use deterministic file paths and exact function names when referencing code edits.
- Estimates should be conservative; if unknown, use a range or mark as TBD.

Example output (short):

Human plan (markdown):

- Phase 1 — Design (2 days)
	- Task: Write design ADR, define schema changes, owners: docs-team@example.com
	- Acceptance: ADR approved by engineering-team@example.com

```yaml
plan:
	name: add-feature-x
	summary: Add feature X to improve Y
	motivation: "Reduce manual work for Z by automating..."
	priority: medium
	stakeholders:
		- docs-team@example.com
		- engineering-team@example.com
	phases:
		- id: design
			title: Design & ADR
			description: Create ADR and high-level tasks
			tasks:
				- id: design-adr
					description: Write ADR describing trade-offs
					file_mods: []
					owner: docs-team@example.com
					estimate_hours: 8
					tests: []
					approval_required: true
					approval_notes: "Engineering review required"
			acceptance_criteria:
				- "ADR recorded and reviewed"
	risks:
		- id: r1
			severity: low
			description: "Minor refactor risk"
			mitigation: "Run unit tests and integration smoke tests"
	rollback:
		- step: revert-pr
			description: "Revert the merge commit and redeploy previous tag"
	artifacts:
		- path: docs/adr/add-feature-x.md
	generated_by: implementation-plan-prompt
	generated_at: "2025-09-09T00:00:00Z"
```

Edge cases and extra guidance for the agent:
- If scope includes database or schema changes, add a dedicated migration task with backup/verification and high-risk approval.
- If external API keys or provider changes are required, do not attempt to modify secrets—add explicit human steps to provide credentials securely.
- When multiple owners are listed, annotate which owner is the approver for each approval_required task.

Validation & CI integration notes (for consumers):
- CI can validate that the YAML is parseable and that files listed in artifacts exist in the PR diff when implemented.
- For tasks marked approval_required: true, CI should flag the PR and require human review before merge.

Deliverable format requirements (strict):
- The response MUST contain exactly two top-level sections in this order:
	1) Human-readable plan (markdown) with the header "# Implementation Plan — <feature_name>"
	2) Machine-readable YAML block using the schema above, fenced as ```yaml
- The YAML MUST be valid and include all required top-level fields (plan.name, plan.summary, plan.phases).

When done, return only the two outputs (human plan and YAML) and nothing else. If any required input is missing, ask exactly one concise clarifying question.

```
