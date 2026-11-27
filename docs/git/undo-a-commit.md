---
title: Undo a Commit
summary: Take back a commit, keeping or discarding its changes, before or after pushing.
type: Recovery
lede: You or your agent committed something too early or by mistake. Pick the fix that matches what you want to keep and whether the commit has been pushed.
meta:
  Applies to: Git
  Platform: macOS / Linux
  Risk: Can lose work
tested_with: git 2.53
status: draft
---

## Look first {#look toc="Look first"}

See what the last commits are, and whether you have changes you have not committed:

```bash
git log --oneline -3
git status
```

If `git status` says your branch is ahead of the remote, those commits are not pushed. If the commit **is** pushed, go to [undo a pushed commit](#pushed).

## Keep the changes {#keep toc="Keep changes"}

Remove the last commit and leave its changes staged:

```bash
git reset --soft HEAD~1
```

Edit anything you need, stage it with `git add`, then commit again with your own message:

```bash
git commit -m "A better message"
```

> [!NOTE]
> **Your first commit is different.** `HEAD~1` does not exist when the repository has only one commit, so Git stops with an error.

## Fix only the message {#message toc="Fix the message"}

Replace the last commit's message. Anything you have staged stays out of the commit:

```bash
git commit --amend --only -m "A clearer message"
```

## Discard the commit and its changes {#discard toc="Discard"}

> [!WARNING]
> **This deletes work.** It removes the last commit and also every uncommitted change to tracked files. Uncommitted changes cannot be recovered.

```bash
git reset --hard HEAD~1
```

## Get it back {#recover toc="Get it back"}

Git keeps a list of where your branch has been, called the [reflog](https://git-scm.com/docs/git-reflog). The line marked `HEAD@{1}` is where you were one step ago:

```bash
git reflog -5
```

If the reset was the last thing you did, go back to that point:

```bash
git reset --hard 'HEAD@{1}'
```

> [!WARNING]
> **Check the line first.** If you have run other commands since, pick the right number from the list. This also discards uncommitted changes.

## Undo a pushed commit {#pushed toc="Already pushed"}

Do not remove a commit that others may already have. [Revert](https://git-scm.com/docs/git-revert) it instead, which adds a new commit with the opposite changes:

```bash
git revert --no-edit HEAD
```

```bash
git push
```

To revert an older commit, replace `HEAD` with its ID from `git log --oneline`. A merge commit needs an extra option, `-m`.

> [!NOTE]
> **Reverting does not hide anything.** The original commit stays in the history. If it contains a password or key, replace that secret.
