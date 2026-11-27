---
title: Throw Away Uncommitted Changes
summary: Discard edits and new files safely, or reset your branch to match the remote.
type: Recovery
lede: An agent or an experiment left your folder in a mess. Look at what changed, then discard one file, everything, or your whole branch's differences from the remote.
meta:
  Applies to: Git
  Platform: macOS / Linux
  Risk: Deletes work
tested_with: git 2.53
verified: 2026-11-26
---

Run these from the top folder of your repository.

## See what changed {#look toc="Look first"}

```bash
git status --short
git diff HEAD
```

`??` marks a new file that Git is not tracking. `git diff HEAD` does not show what is inside those.

## Set it aside instead {#stash toc="Set aside"}

If you might want any of it later, [stash](https://git-scm.com/docs/git-stash) it. This cleans the folder, including new files:

```bash
git stash push -u -m "before cleaning up"
```

To bring it back:

```bash
git stash pop
```

## Discard one file {#one toc="One file"}

> [!WARNING]
> **There is no undo.** Changes that were never committed or stashed cannot be recovered reliably. If the file is new and staged, this deletes it.

Replace `path/to/file`:

```bash
git restore --source=HEAD --staged --worktree -- path/to/file
```

## Discard everything {#all toc="Everything"}

> [!WARNING]
> **This discards every change to tracked files,** staged or not.

```bash
git restore --source=HEAD --staged --worktree -- .
```

New files that Git is not tracking are still there. List what would be deleted:

```bash
git clean -nd
```

> [!WARNING]
> **Read that list before the next command.** It deletes those files and folders permanently.

```bash
git clean -fd
```

Ignored files, such as `.env`, are left alone.

## Match the remote {#remote toc="Match the remote"}

Use this when your branch has commits or changes you do not want and the remote copy is right. The example uses `main`; run it **while on `main`**.

```bash
git fetch origin
```

Keep a pointer to your current commits, in case you need them:

```bash
git branch backup-before-reset
```

> [!WARNING]
> **This discards local commits and uncommitted changes** on your current branch. The backup branch keeps the commits, not the uncommitted changes.

```bash
git reset --hard origin/main
```

When you no longer need the backup, remove it with `git branch -D backup-before-reset`.
