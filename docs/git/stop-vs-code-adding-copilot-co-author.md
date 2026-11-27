---
title: Stop VS Code Adding Copilot as Co-Author
summary: Turn the setting off and clean up commits that already have it.
type: How-to
lede: VS Code can add a Copilot co-author line to your commit messages. Turn that off, remove it from existing commits, and optionally block it for good.
meta:
  Applies to: VS Code, Git
  Platform: macOS / Linux
  Risk: Rewrites history if you clean up old commits
tested_with: git 2.53
status: draft
---

## Turn the setting off {#setting toc="Turn it off"}

Open your user settings (`settings.json`) and set [`git.addAICoAuthor`](https://code.visualstudio.com/docs/sourcecontrol/staging-commits) to `off`:

```json title="settings.json" check=json manual="VS Code behaviour: https://code.visualstudio.com/docs/sourcecontrol/staging-commits"
{
  "git.addAICoAuthor": "off"
}
```

The other values are `chatAndAgent` and `all`. [VS Code 1.118](https://code.visualstudio.com/updates/v1_118) switched the line on by default, while current documentation lists `off` as the default. Setting it yourself means it does not depend on your version.

The setting only affects commits made through VS Code's own Git features, not commits made by other tools or typed in a terminal.

## Remove it from existing commits {#clean toc="Clean up commits"}

1. **Find the commits that have it**

   ```bash
   git log -i --grep='^co-authored-by: copilot' --format='%h %ad %s' --date=short
   ```

2. **Fix the last commit**

   `--only` changes the message without adding anything you have staged.

   ```bash
   git log -1 --format=%B | grep -viE '^co-authored-by: copilot ' | git commit --amend --only -F -
   ```

3. **Fix older commits**

   > [!WARNING]
   > **This changes commit hashes.** Commit or stash your work first. If others share the branch, agree this with them.

   Replace `N` with how many recent commits to rewrite.

   ```bash
   FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \
     --msg-filter 'grep -viE "^co-authored-by: copilot " || true' \
     HEAD~N..HEAD
   ```

4. **Replace what you already pushed**

   Only needed if those commits were on GitHub. Replace `main` with your branch.

   ```bash
   git push --force-with-lease origin main
   ```

If GitHub still lists Copilot as a contributor afterwards, see [Remove an Old Contributor GitHub Still Shows](remove-old-contributor-from-github.md#refresh).

## Block it in one repository {#hook toc="Block it with a hook"}

A [`commit-msg` hook](https://git-scm.com/docs/githooks#_commit_msg) removes the line from every new commit in this repository, whatever added it.

> [!WARNING]
> **This replaces any `commit-msg` hook you already have.** Check first, and add the `grep` line to your own hook instead if there is one.

```bash
hooks="$(git rev-parse --git-path hooks)"
mkdir -p "$hooks"
cat > "$hooks/commit-msg" <<'HOOK'
#!/bin/sh
grep -viE '^co-authored-by: copilot ' "$1" > "$1.tmp"
mv "$1.tmp" "$1"
HOOK
chmod +x "$hooks/commit-msg"
```

Hooks are not copied by `git clone`, so each person and each clone needs its own.
