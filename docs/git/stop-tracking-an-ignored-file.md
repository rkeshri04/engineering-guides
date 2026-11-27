---
title: Stop Tracking a File in .gitignore
summary: Remove a file from Git but keep it on your machine, when .gitignore alone does nothing.
type: How-to
lede: Adding a file to .gitignore has no effect once Git is already tracking it, such as an .env file that was committed by mistake. Remove it from Git and keep your copy.
meta:
  Applies to: Git
  Platform: macOS / Linux
  Risk: Removes the file for others
tested_with: git 2.53
status: draft
---

## Stop tracking one file {#one toc="One file"}

The examples use `.env`. Replace it with your file.

> [!WARNING]
> **A committed secret is already exposed.** These steps do not remove it from earlier commits. If the file holds a password or key and was ever pushed, replace that secret first.

1. **Ignore the file**

   Skip this if `.gitignore` already covers it.

   ```bash
   printf '\n.env\n' >> .gitignore
   ```

2. **Check that Git still tracks it**

   This lists tracked files that your ignore rules cover:

   ```bash
   git ls-files -ci --exclude-standard
   ```

3. **Remove it from Git only**

   `--cached` keeps the file in your folder.

   ```bash
   git rm --cached .env
   ```

4. **Commit**

   Anything else you have staged goes into this commit too, so check `git status` first.

   ```bash
   git add .gitignore
   git commit -m "Stop tracking .env"
   ```

> [!WARNING]
> **Others lose their copy.** When someone else pulls this commit, Git deletes the file from their folder. Tell them to back it up first.

## A whole folder {#folder toc="A folder"}

Add the folder to `.gitignore`, then remove it from Git with `-r`. The example uses `build`:

```bash
printf '\nbuild/\n' >> .gitignore
git rm -r --cached build
git add .gitignore
git commit -m "Stop tracking build output"
```

## Everything already ignored {#all toc="All at once"}

First read the list:

```bash
git ls-files -ci --exclude-standard
```

If every file on it should leave Git, remove them all. Skip this if the list is empty:

```bash
git ls-files -ci --exclude-standard -z | xargs -0 git rm --cached --
git commit -m "Stop tracking ignored files"
```

## Remove it from history {#history toc="History"}

The steps above only affect new commits. To remove a secret from old ones, follow GitHub's guide to [removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). It rewrites history, and replacing the secret still comes first.
