---
title: Fix a Rejected Push
summary: Get past "failed to push some refs" without losing anyone's commits.
type: Recovery
lede: Git rejected your push because the remote has commits you do not. Look at them, put yours on top, and push again.
meta:
  Applies to: Git
  Platform: macOS / Linux
  Risk: Low, unless you force
tested_with: git 2.53
status: draft
---

This is for a push that ends with `error: failed to push some refs` and a `[rejected]` line saying `fetch first` or `non-fast-forward`. Other messages, such as a failed login or a protected branch, need a different fix.

The examples use `main`; run them **while on `main`**.

## See what you are missing {#look toc="Look first"}

```bash
git fetch origin
```

Commits on the remote that you do not have:

```bash
git log --oneline HEAD..origin/main
```

Your commits that the remote does not have:

```bash
git log --oneline origin/main..HEAD
```

## Put your commits on top {#rebase toc="Rebase and push"}

[Rebase](https://git-scm.com/docs/git-pull#Documentation/git-pull.txt---rebasetruemergesfalseinteractive) replays your commits after the remote ones. `--autostash` sets uncommitted changes aside and brings them back afterwards.

```bash
git pull --rebase --autostash origin main
```

Run your tests, then push:

```bash
git push origin main
```

## If there is a conflict {#conflict toc="Conflicts"}

Git stops and names the files. Open each one, keep what you want, and remove the `<<<<<<<`, `=======` and `>>>>>>>` lines. Then mark each file as resolved:

```bash manual="only if there is a conflict"
git add path/to/file
```

```bash manual="only if there is a conflict"
git rebase --continue
```

To give up and return to where you were before pulling:

```bash manual="only if there is a conflict"
git rebase --abort
```

## If you rewrote history yourself {#rewrote toc="After a rewrite"}

If you amended or rebased commits you had already pushed, pulling would bring the old ones back. You need to replace the remote branch instead.

> [!WARNING]
> **This removes commits from the remote.** First run the commands in [See what you are missing](#look). The first list should show only the old versions of your own commits. If it shows anyone else's work, stop.

```bash manual="only after you rewrote history on purpose"
git push --force-with-lease origin main
```

`--force-with-lease` refuses if the remote changed since your last fetch. It does not protect commits you have already fetched, which is why you read the list. Never use plain `--force` here.
