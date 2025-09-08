---
title: "Copilot/MCP Agent Tool Reference for Prompts/Chatmodes"
description: |
  This file documents the accepted tool names for VS Code Copilot Chat/MCP agent prompts and chatmode definitions.
  It also includes a YAML example for usage in prompt/chatmode front matter, and instructions for dynamically checking the active tool list from your environment or repo.
updated: 2025-09-08
---

# Copilot/MCP Agent Tool Reference

## Overview

Below is a list of commonly accepted tool names for use in `tools:` arrays in [chatmode](../chatmodes/) and [prompt](../prompts/) definitions for Copilot/MCP agents (including Copilot Chat in VS Code and compatible MCP servers).

These control the agent's "capabilities" and should match the strings supported by your Copilot/MCP deployment (case-sensitive).
**Always check your deployment for the latest set, as the active tool list can change with upgrades, extensions, and admin config.**

---

## Commonly Accepted Tool Names

- **codebase** — High-level repository access, search, or summary
- **changes** — Changelog or diff summary capabilities
- **editFiles** — Create or edit files in the workspace
- **new** — Create new files/artifacts
- **search** — Perform code or repo-wide search
- **searchResults** — Return or consume structured search results
- **findTestFiles** — Discover test files in the repo
- **usages** — Find symbol usages
- **runCommands** — Execute shell/CLI commands
- **runTasks** — Run project/workspace tasks
- **runTests** — Execute test suites
- **terminalLastCommand** — Access the last terminal command
- **terminalSelection** — Run a selected snippet in terminal
- **testFailure** — Fetch or report test failure details
- **problems** — View or create editor/IDE problem diagnostics
- **githubRepo** — Fetch repo metadata, perform repo-level actions
- **fetch** — Make external HTTP requests / fetch web/artifact content
- **openSimpleBrowser** — Open simplified browser context for docs/web
- **extensions** — Inspect or recommend VS Code extensions

---

## Example Usage in Prompt/Chatmode

```yaml
---
description: "Debug mode for Python and cloud"
tools:
  - editFiles
  - search
  - runCommands
  - problems
  - runTests
  - fetch
  - githubRepo
---
```

---

## How To Dynamically Fetch the Active Tool List

### 1. From a Copilot/MCP Deployment (API/CLI)

If you have access to your MCP/Copilot server, you can typically fetch the active tool list by:

- Viewing the MCP server’s `/metadata`, `/capabilities`, or `/manifest` endpoint (consult your MCP server docs).
- Example (pseudo-API call):
  ```
  curl https://<your-mcp-server>/api/metadata
  # or
  curl https://<your-mcp-server>/api/capabilities
  ```
- The returned JSON will often contain a list of currently enabled tools/capabilities.

### 2. From a Repo of Chatmode Definitions

You can programmatically extract all tool names currently used in your repo like this:

**Example Python script (run at repo root):**

```python
import glob, yaml
tools = set()
for file in glob.glob('.github/chatmodes/*.chatmode.md'):
    with open(file, 'r', encoding='utf-8') as f:
        front = f.read().split('---', 2)
        if len(front) > 2:
            data = yaml.safe_load(front[1])
            if 'tools' in data:
                tools.update(data['tools'])
print("Active tool names:", sorted(tools))
```

Or, use `ripgrep`/`grep`:

```sh
rg '^tools:' .github/chatmodes/
```

### 3. In VS Code (Copilot Chat)

- Open the Copilot Chat sidebar, go to “Settings” or “Server Info”—active capabilities/tools are often listed there.
- For Codespaces/devcontainers, the available tools may be auto-detected per workspace.

---

## Best Practice

- Keep this file up to date when onboarding new team members or adding new agent modes.
- When adding a new tool to an agent, check with your MCP server admin or consult the repo's chatmode/prompt files to confirm support.

---

_Last updated: 2025-09-08_
