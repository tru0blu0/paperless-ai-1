import sys
from pathlib import Path
# ensure the copilot-instructions folder is on sys.path so `scripts` is importable
HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from scripts.orchestrator import build_plan


def test_select_modules_prompt_and_security():
    task = 'Improve prompt injection mitigation and review prompt templates for LLMs'
    s, r, p = build_plan(task)
    modules = [m['module'] for m in p['modules']]
    assert 'prompt' in modules
    assert 'security' in modules or p['approval_required'] is True
