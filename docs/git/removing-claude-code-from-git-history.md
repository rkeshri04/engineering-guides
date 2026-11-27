---
title: Removing Claude Code From Git History
summary: Strip attribution, rewrite authorship, force-push.
eyebrow: Part 1 · Reusable Guide
type: Reference
lede: A repeatable procedure for stopping automatic attribution, rewriting authorship and commit trailers across existing history, and publishing the cleaned branch.
meta:
  Applies to: Git, GitHub
  Platform: macOS / Linux
  Editor: VS Code
  Risk: Rewrites history
---

## Prevent Claude Code from adding attribution {#prevent toc="Prevent future attribution"}

Before committing new work, add an empty `attribution` object to your global Claude settings file (`~/.claude/settings.json`) or project settings (`.claude/settings.local.json`).

```json title="settings.json"
{
  "attribution": {
    "commit": "",
    "pr": ""
  }
}
```

> [!NOTE]
> **Optional.** Set VS Code as your default Git editor once, so rebase prompts open as normal text tabs instead of Vim.

```bash
git config --global core.editor "code --wait"
```

## Strip author, trailers, and unwanted files across past commits {#rewrite toc="Rewrite past commits"}

Make sure you are on your actual branch (not a detached `HEAD`) before running this. Replace `N` with the number of recent commits you want to rewrite, or replace `HEAD~N..HEAD` with `-- --all` to rewrite the entire repository.

```bash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \
  --env-filter '
    export GIT_AUTHOR_NAME="Your Name"
    export GIT_AUTHOR_EMAIL="you@example.com"
    export GIT_COMMITTER_NAME="Your Name"
    export GIT_COMMITTER_EMAIL="you@example.com"
  ' \
  --index-filter 'git rm --cached --ignore-unmatch CLAUDE.md docs/GUIDE.md' \
  --msg-filter 'grep -viE "^(Co-Authored-By|Claude-Session):"' \
  HEAD~N..HEAD
```

### Flag reference

| Flag | Purpose |
| --- | --- |
| `--env-filter` | Overwrites both the Author and Committer fields with your GitHub identity. |
| `--index-filter` | Removes unwanted files across every commit in the range without causing merge conflicts. Omit this flag if you don't need to delete files. |
| `--msg-filter` | Uses `grep -viE` (macOS-compatible) to strip `Co-Authored-By:` and `Claude-Session:` lines. |

## Manually edit a specific commit's files or message {#edit toc="Edit a specific commit"}

Use this when you need to adjust a single commit — for example, `HEAD~1` for the second-to-last commit.

1. **Start an interactive rebase covering that commit**

   Using `HEAD~2` opens the last two commits.

   ```bash
   git rebase -i HEAD~2
   ```

2. **Mark the commit for editing**

   In VS Code, change `pick` to `edit` only on the commit you want to modify. Press <kbd>⌘</kbd> <kbd>S</kbd>, then <kbd>⌘</kbd> <kbd>W</kbd>.

3. **Make your edits**

   - Edit any files in VS Code, save them, and run `git add <filename>`.
   - Run `git commit --amend` to edit the message in VS Code, or `git commit --amend --no-edit` to keep the existing message.

4. **Finish the rebase**

   Continue until your terminal confirms the branch was updated.

   ```bash
   git rebase --continue
   ```

## Force-push and clear GitHub's cache {#push toc="Force-push & clear cache"}

1. **Push the rewritten history**

   If your branch is named `claude/...`, rename it first with `git branch -m main`.

   ```bash
   git push --force origin main
   ```

2. **Clear GitHub's Contributors cache**

   If Claude still appears in the Contributors sidebar on GitHub, go to **Settings → Branches**, rename `main` to `main-temp`, and immediately rename it back to `main`.

> [!WARNING]
> **Heads up.** Force-pushing replaces the remote history. Anyone else working on the branch will need to re-clone or hard-reset to the new history.
