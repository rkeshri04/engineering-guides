---
title: Pull Only the Branch You Need
summary: Stop git pull fetching every branch on a busy repository.
type: How-to
lede: By default, git pull fetches every branch on the remote before updating yours. Fetch just the branches you work on, once or permanently.
meta:
  Applies to: Git
  Platform: macOS / Linux
  Risk: Low
tested_with: git 2.53
status: draft
---

## Just this once {#once toc="One pull"}

The examples use the branch `main`. Run this **while on `main`**:

```bash
git pull origin main
```

> [!WARNING]
> **Check your branch first.** On any other branch, this merges `main` into it.

Naming the branch makes Git fetch only that one. Your other remote branches are not updated:

```bash
git branch -r -v
```

## Make it permanent {#always toc="Make it permanent"}

This tells your clone to track only `main` from `origin`. It changes nothing on the server or for other people.

```bash
git remote set-branches origin main
```

A plain `git pull` now fetches only that branch:

```bash
git pull
```

Branches you fetched earlier stay in your list but are no longer updated. Remove one you do not need. Replace `feature` with its name:

```bash
git branch -r -d origin/feature
```

## Add a branch or undo {#change toc="Add or undo"}

To follow one more branch, such as `release`:

```bash
git remote set-branches --add origin release
git fetch origin
```

To go back to fetching everything:

```bash
git remote set-branches origin '*'
git fetch origin
```

## Start with one branch {#clone toc="Clone one branch"}

For a new copy, ask for a single branch when you [clone](https://git-scm.com/docs/git-clone#Documentation/git-clone.txt---single-branch). Replace the address:

```bash
git clone --single-branch --branch main https://github.com/OWNER/REPO.git
```
