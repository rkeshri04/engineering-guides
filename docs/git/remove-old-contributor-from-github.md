---
title: Remove an Old Contributor GitHub Still Shows
summary: Find where the name still is, fix it, and refresh GitHub's list.
type: Recovery
lede: GitHub still lists someone under Contributors who should not be there. First find out whether your history still mentions them, then fix the history or GitHub's list.
meta:
  Applies to: Git, GitHub
  Platform: macOS / Linux
  Risk: Rewrites history
tested_with: git 2.53
status: draft
---

## Find where the name still is {#find toc="Find the commits"}

GitHub builds the contributors graph from commits on the [default branch](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-a-projects-contributors), matching them to accounts by email address. A person can be there as author, as committer, or in a [`Co-authored-by` line](https://docs.github.com/en/pull-requests/how-tos/commit-changes/creating-a-commit-with-multiple-authors) in a commit message.

The commands below use `main` as the default branch and `old@example.com` as the unwanted address. Replace both with yours.

1. **Get the current state of GitHub**

   ```bash
   git fetch --prune origin
   ```

2. **List every author and committer**

   ```bash
   git log origin/main --format='%an <%ae>%n%cn <%ce>' | sort | uniq -c | sort -rn
   ```

3. **List every co-author**

   This is the one that is easy to miss: `git shortlog` does not show co-authors by default.

   ```bash
   git log origin/main --format='%(trailers:key=Co-authored-by,valueonly)' | sed '/^$/d' | sort | uniq -c
   ```

4. **Show the commits that mention the address**

   ```bash
   git log origin/main -i --author='old@example.com' --format='%h %ad %s' --date=short
   git log origin/main -i --grep='^co-authored-by:.*old@example.com' --format='%h %ad %s' --date=short
   ```

If neither command in step 4 prints anything, check committers in the list from step 2. If the address is nowhere, your history is already clean: skip to [refreshing GitHub's list](#refresh).

## Rewrite only those commits {#rewrite toc="Rewrite the history"}

> [!WARNING]
> **Only change attribution that is wrong.** Use this for your own old address, a bot or a tool. Do not take credit for another person's work.

> [!WARNING]
> **This changes commit hashes.** The first changed commit and every commit after it get new ones. Tell anyone who shares the branch, and merge or close open pull requests first.

Commit or stash your work first. Then bring your local branch up to date:

```bash
git switch main
git pull --ff-only origin main
```

Replace the address, name and email. Commits by other people are left as they are.

```bash
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \
  --env-filter '
    if [ "$GIT_AUTHOR_EMAIL" = "old@example.com" ]; then
      export GIT_AUTHOR_NAME="Your Name" GIT_AUTHOR_EMAIL="you@example.com"
    fi
    if [ "$GIT_COMMITTER_EMAIL" = "old@example.com" ]; then
      export GIT_COMMITTER_NAME="Your Name" GIT_COMMITTER_EMAIL="you@example.com"
    fi
  ' \
  --msg-filter 'grep -viE "^Co-authored-by:.*old@example.com" || true' \
  -- main
```

Check that the address is gone. This should print `0`:

```bash
git log main --format='%an <%ae>%n%cn <%ce>%n%B' | grep -ci 'old@example.com' || true
```

Then replace the branch on GitHub:

```bash
git push --force-with-lease origin main
```

> [!NOTE]
> **Git keeps a backup** of the old commits on your machine under `refs/original/`.

## Refresh GitHub's list {#refresh toc="Refresh GitHub"}

GitHub does not document when the Contributors list is recalculated, so give it a day first.

If the name is still there, people report that renaming the default branch and renaming it straight back makes GitHub rebuild the list. This is a workaround, not a documented feature.

1. **Rename the branch**

   On the repository's **Branches** page, [rename](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch) `main` to `main-temp`. Renaming the default branch needs admin access.

2. **Rename it back**

   Rename `main-temp` to `main`, then reload the repository page.

> [!WARNING]
> **While the branch has the temporary name**, links to raw files on `main` and `git pull` of `main` do not work. Do both renames together.

Forks and closed pull requests can still hold the old commits. They are not part of your default branch.
