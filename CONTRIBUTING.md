# Contributing a guide

A good guide solves one problem. It is short, its commands work, and it says plainly what they change.

Pull requests need passing checks and a maintainer's review before they are merged.

## Quick start

1. Create `docs/<category>/<slug>.md`. Names are lowercase-with-hyphens, and a slug may be used only once across all categories.
2. Create its test beside it: `docs/<category>/<slug>.test.sh`.
3. Run the checks:

```bash
npm ci
npm run check
npm run build
npm test -- <slug>
```

A new category also needs `docs/<category>/_category.json`:

```json
{
  "name": "Git",
  "description": "Working with history, branches and remotes.",
  "order": 1
}
```

Only `name` is required.

## Write the guide

### Front matter

| Key | Required | Meaning |
| --- | --- | --- |
| `title` | yes | One line |
| `summary` | yes | One line, shown in lists and in `llms.txt` |
| `type` | yes | `Reference`, `How-to` or `Recovery` |
| `lede` | no | Introduction under the title |
| `eyebrow` | no | Small line above the title. Defaults to the category name. |
| `meta` | no | Facts shown under the introduction, such as `Risk: Rewrites history` |
| `verified` | no | `YYYY-MM-DD`. The day you checked every step, manual ones included. |
| `tested_with` | no | Versions you used, such as `git 2.53` |
| `status` | no | `published` (default) or `draft` |
| `order` | no | Position within the category |

Unknown keys are errors. A guide with no `verified` date, or one older than 90 days, gets a warning.

### Sections

Each `##` heading starts a numbered section. Set a stable link and a short label for the table of contents like this:

```markdown
## Undo the last commit {#undo toc="Undo"}
```

### Callouts

```markdown
> [!NOTE]
> **Optional.** Something worth knowing.

> [!WARNING]
> **Heads up.** Something that can lose work.
```

Put a warning **before** the command it is about.

### Steps

Use a numbered list. Start each item with a bold line to give the step a title:

````markdown
1. **Check where you are**

   ```bash
   git status
   ```
````

### Code blocks

Give every block a language. These labels go after it:

| Label | Meaning |
| --- | --- |
| `title="settings.json"` | Heading shown on the block |
| `manual="reason"` | The test does not run it. The reason is required. |
| `check=json` | The test only checks that it is valid JSON |

In a guide with a test, `bash` and `sh` blocks are run unless marked `manual`. Every other block needs `manual` or `check=json`.

Commands written inside a sentence are not run automatically. If one matters, run it yourself in the test's `verify()`.

### Links, HTML and other limits

- Link to another guide with a relative path to its `.md` file, such as `../git/other-guide.md`.
- Links may use `http`, `https` or `mailto`. Domains outside `linkAllowlist` in `site.config.json` are flagged.
- Images must be hosted at an `http` or `https` address.
- The only HTML allowed is `<kbd>`, `<details>` and `<summary>`.
- HTML comments, invisible characters and unused link definitions are rejected, so that nothing is hidden from a human reader.
- Never refer to anything under `internal/`.

## Write the test

The test does not repeat the guide's commands. The runner takes them from the guide and runs them in order. The test file sets up the problem and checks that it was solved.

It is a bash file that defines:

| Name | Purpose |
| --- | --- |
| `SUBSTITUTE` | Optional list of `"from=to"` replacements for placeholders in the commands. Each one must match something. |
| `setup()` | Create the situation the guide starts from |
| `verify()` | Check the result. Stop with `fail "message"`. |

How a test runs:

- In a temporary folder. `$WORKDIR` is a new Git repository, `$ORIGIN` is a local bare repository set as its `origin`, and `$HOME` is empty apart from a test Git identity.
- Each code block runs with `bash -euo pipefail`, starting in `$WORKDIR`. A `cd` or `export` in one block does not carry into the next.
- Git can only reach local paths. Nothing can open an editor.
- `setup()`, each block and `verify()` have 60 seconds each.
- Keep it working with the bash 3.2 that macOS ships.

Helpers from [`tests/lib.sh`](tests/lib.sh):

| Helper | Does |
| --- | --- |
| `commit <path> <subject> [trailer]...` | Add a line to a file and commit it |
| `fail <message>` | Stop the test |
| `assert_eq <got> <expected> [label]` | Compare two values |
| `assert_identity <range> <name> <email>` | Check author and committer |
| `assert_no_trailer <range> <name>...` | Check that commit trailers are gone |
| `assert_files_absent <range> <path>...` | Check that files are in no commit of the range |
| `remember <key> <value>`, `recall <key>` | Pass a value from `setup()` to `verify()` |
| `output_of <block number>` | What a block printed. Count every code block, from 1. |

A command that only looks for something succeeds even when it finds nothing, so check its output with `output_of`.

## Test a guide

> [!WARNING]
> **`npm test` runs the guide's commands on your computer.** The temporary folder and fresh environment prevent accidents, but they are not a security boundary. Before testing a guide or test file you did not write, read both.

```bash
npm test                 # every guide that has a test
npm test -- <slug>       # one guide
npm test -- <slug> --keep   # keep the temporary folder to look around
```

When a block fails, the output names the block, its section and the error.

## Templates

Copy both, rename them, and edit. Together they pass the checks as they are, apart from a warning that there is no `verified` date yet.

### Guide: `docs/git/undo-the-last-commit.md`

````markdown
---
title: Undo the Last Commit
summary: Take back a commit and keep its changes.
type: How-to
lede: You committed too early and want the changes back, ready to commit again.
meta:
  Applies to: Git
  Risk: Rewrites local history
---

## Undo the commit {#undo toc="Undo"}

> [!WARNING]
> **Only for commits you have not pushed.** This rewrites your branch.

1. **Remove the commit and keep its changes**

   ```bash
   git reset --soft HEAD~1
   ```

2. **Check what is staged**

   ```bash
   git status --short
   ```

3. **Commit again when ready**

   ```bash manual="opens your editor"
   git commit
   ```
````

### Test: `docs/git/undo-the-last-commit.test.sh`

```bash
# Scenario: two commits; the guide takes back the second.

SUBSTITUTE=()

setup() {
  commit README.md "one: readme"
  commit app.txt   "two: too early"
}

verify() {
  assert_eq "$(git log --format=%s)" "one: readme" "history"
  assert_eq "$(git diff --cached --name-only)" "app.txt" "staged files"
}
```

## Open a pull request

Before you push:

- `npm run check` reports no errors, and you have looked at each warning.
- `npm run build` succeeds, and the page looks right in `npm run dev`.
- `npm test` passes.

The same checks run on your pull request. A maintainer reviews it, paying particular attention to commands and links.
