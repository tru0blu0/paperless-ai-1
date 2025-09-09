"""Simple orchestrator that selects instruction modules based on task input.
This is intentionally small: it demonstrates mapping user intent keywords to
instruction modules and produces a machine-readable plan.
"""
import yaml
from pathlib import Path
from .sanitizer import sanitize_text

INSTRUCTION_DIR = Path(__file__).resolve().parents[1] / 'copilot-instructions'

MODULE_KEYWORDS = {
    'docker': ['docker', 'container', 'compose', 'image'],
    'security': ['security', 'owasp', 'vuln', 'scan'],
    'prompt': ['prompt', 'llm', 'gemini', 'vertex', 'openai'],
    'ci': ['ci', 'actions', 'workflow', 'deploy'],
    'perf': ['performance', 'profiling', 'benchmark']
}

def select_modules(task_text: str):
    words = task_text.lower()
    selected = []
    for module, kws in MODULE_KEYWORDS.items():
        for k in kws:
            if k in words:
                selected.append(module)
                break
    return selected

def build_plan(task_input: str, user_email: str = None):
    sanitized, report = sanitize_text(task_input)
    modules = select_modules(sanitized)
    plan = {
        'modules': [],
        'approval_required': False,
        'confidence': round(len(modules) / max(1, len(MODULE_KEYWORDS)), 2)
    }
    for m in modules:
        # map simple module to existing files
        if m == 'docker':
            file = 'containerization-docker-paperless-ai.md'
        elif m == 'security':
            file = 'security-and-owasp-paperless-ai.md'
        elif m == 'prompt':
            file = 'ai-prompt-engineering-safety-paperless-ai.md'
        elif m == 'ci':
            file = 'github-actions-ci-cd-paperless-ai.md'
        elif m == 'perf':
            file = 'performance-optimization-paperless-ai.md'
        else:
            file = None
        plan['modules'].append({'module': m, 'file': str(INSTRUCTION_DIR / file) if file else None, 'reason': 'keyword match'})
        if m in ('security', 'prompt'):
            plan['approval_required'] = True
    return sanitized, report, plan

def main():
    import sys
    if len(sys.argv) < 2:
        print('Usage: orchestrator.py "task text"')
        sys.exit(1)
    task = sys.argv[1]
    s, r, p = build_plan(task)
    print(yaml.safe_dump({'sanitized': s, 'report': r, 'plan': p}, sort_keys=False))

if __name__ == '__main__':
    main()
