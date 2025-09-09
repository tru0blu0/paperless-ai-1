"""
Script: sync_upstream_copilot_repos.py

Fetches and summarizes folder structures and key documentation from authoritative Copilot/AI agent repositories.
- github/awesome-copilot
- openai/openai-cookbook
- microsoft/semantic-kernel

Outputs summaries to stdout and saves latest README files locally for reference.
Extend as needed for deeper diffing or automation.
"""

from pathlib import Path

import requests

REPOS = [
    "github/awesome-copilot",
    "openai/openai-cookbook",
    "microsoft/semantic-kernel"
]

OUTDIR = Path("upstream_repo_snapshots")
OUTDIR.mkdir(exist_ok=True)


def fetch_repo_structure(repo, subdir=None):
    api_url = f"https://api.github.com/repos/{repo}/contents/"
    if subdir:
        api_url += f"/{subdir}"
    resp = requests.get(api_url)
    resp.raise_for_status()
    return resp.json()

def fetch_readme(repo):
    api_url = f"https://api.github.com/repos/{repo}/readme"
    resp = requests.get(api_url, headers={"Accept": "application/vnd.github.v3.raw"})
    resp.raise_for_status()
    return resp.text

def save_file(repo, filename, content, subdir=None):
    repo_dir = OUTDIR / repo.replace("/", "-")
    if subdir:
        repo_dir = repo_dir / subdir
    repo_dir.mkdir(parents=True, exist_ok=True)
    (repo_dir / filename).write_text(content, encoding="utf-8")






def diff_files(local_path, new_content):
    if not local_path.exists():
        return None
    old_content = local_path.read_text(encoding="utf-8")
    if old_content == new_content:
        return None
    import difflib
    diff = difflib.unified_diff(
        old_content.splitlines(),
        new_content.splitlines(),
        fromfile='old',
        tofile='new',
        lineterm=''
    )
    return '\n'.join(diff)

def main():
    for repo in REPOS:
        print(f"\n=== {repo} ===")
        try:
            structure = fetch_repo_structure(repo)
            folders = [item['name'] for item in structure if item['type'] == 'dir']
            files = [item['name'] for item in structure if item['type'] == 'file']
            print("Folders:", folders)
            print("Files:", files)
            readme = fetch_readme(repo)
            print(f"README.md (first 500 chars):\n{readme[:500]}\n---")
            save_file(repo, "README.md", readme)
            # Fetch and diff prompt/instruction/chatmode files
            for subdir, exts in [
                ("prompts", [".md", ".prompt.md"]),
                ("instructions", [".md", ".instructions.md"]),
                ("chatmodes", [".md", ".chatmode.md"])
            ]:
                if subdir in folders:
                    print(f"  Fetching {subdir}/ ...")
                    try:
                        items = fetch_repo_structure(repo, subdir)
                        for item in items:
                            if item['type'] == 'file' and any(item['name'].endswith(ext) for ext in exts):
                                raw_url = item['download_url']
                                resp = requests.get(raw_url)
                                resp.raise_for_status()
                                repo_dir = OUTDIR / repo.replace("/", "-") / subdir
                                repo_dir.mkdir(parents=True, exist_ok=True)
                                local_path = repo_dir / item['name']
                                diff = diff_files(local_path, resp.text)
                                if diff:
                                    print(f"    DIFF for {subdir}/{item['name']}\n{diff}\n---")
                                save_file(repo, item['name'], resp.text, subdir=subdir)
                    except Exception as e:
                        print(f"    Error fetching {subdir} in {repo}: {e}")
        except Exception as e:
            print(f"Error fetching {repo}: {e}")


if __name__ == "__main__":
    main()
