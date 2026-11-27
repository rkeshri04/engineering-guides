# Engineering Guides

Short, problem-shaped guides for developers who work with AI coding agents. Each guide solves one problem, reads well for a person, and is just as easy to hand to an agent.

**Read the guides:** https://rkeshri04.github.io/engineering-guides/

## What you can expect from a guide

**Verified.** In a guide with a test file, every code block is either run by that test, checked as valid JSON, or marked manual with a reason. Each guide page shows how many of its steps are tested automatically, and when it was last verified. A guide with no test shows 0 tested steps.

**Agent-friendly.** Every guide is also published as plain Markdown, and the site has an [`llms.txt`](https://llmstxt.org/) index.

**Checked for hidden instructions.** Automated checks reject text that a person reading the page would not see but an agent might: invisible characters, HTML comments, raw HTML beyond a few harmless tags, and unused link definitions. Risky-looking commands and links to unlisted domains are flagged for the reviewer.

These checks have limits. They cannot judge whether visible text is a good idea, and the tests cover code blocks, not every sentence. Read a guide before you let an agent run it.

## Use a guide with an AI agent

On a guide page:

- **Use with AI → Copy link for AI** copies the address of the Markdown version. Paste it into your agent, for example: `Read <link> and help me with it`.
- **Use with AI → Open in Claude** or **Open in ChatGPT** starts a chat with that prompt filled in.
- **Copy page** copies the whole guide as Markdown, for tools that cannot open links.

Agents can also read these directly:

| Address | Contents |
| --- | --- |
| [`/llms.txt`](https://rkeshri04.github.io/engineering-guides/llms.txt) | Every published guide, with a link and a summary |
| [`/llms-full.txt`](https://rkeshri04.github.io/engineering-guides/llms-full.txt) | All published guides in one file |
| `/<category>/<slug>.md` | One guide |

## Local development

You need the Node version in [`.nvmrc`](.nvmrc). The guide tests also need `git` and `bash`.

```bash
nvm use
npm ci
npm run dev
```

The site is then at http://localhost:4000/engineering-guides/. It rebuilds when you save; reload the page to see the change.

| Command | What it does |
| --- | --- |
| `npm run dev` | Build, watch and serve. Add `-- --port 4001` to use another port. |
| `npm run build` | Build the site into `dist/` |
| `npm run check` | Content and safety checks |
| `npm test` | Run the guides' tests. Read [the warning](CONTRIBUTING.md#test-a-guide) before testing someone else's guide. |
| `npm run test:unit` | Test the checks, the test runner and the topic collector |
| `npm run topics` | Collect [ideas for new guides](#find-topics) |

The build is deterministic: the same files give the same output. Set `BASE_PATH` or `SITE_URL` to override the values in `site.config.json`.

## Find topics

`npm run topics` searches Stack Overflow, GitHub issues and Hacker News for common, unsettled and recent problems. It writes a ranked list to `topics/report.md`, which Git ignores. Only titles, counts and links are collected.

```bash
npm run topics
npm run topics -- --subject git --days 180 --limit 15
```

- Subjects, searches and excluded title phrases are in [`topics.config.json`](topics.config.json).
- `--limit` is the number of results per source in each subject.
- No keys are needed. Setting `GITHUB_TOKEN` makes the run much faster; `STACKEXCHANGE_KEY` raises the daily Stack Overflow limit.
- Titles are written by strangers. If you give the report to an agent, tell it to treat them as data.

A high score means a problem is worth a look, not that it makes a good guide.

## Drafts and internal guides

- **Drafts** are guides under `drafts/<category>/`, or with `status: draft`. They are left out of the published site. Preview them with `npm run dev -- --drafts`. A committed draft is still visible in the repository.
- **Internal guides** live in `internal/<category>/`, laid out like `docs/`. Git ignores the folder. `npm run dev -- --include-internal` shows them, and `npm run build -- --include-internal` writes to `dist-internal/`. Never publish that folder. A normal build does not include internal guides and fails if its output mentions one. `npm run check` does not check them.

## Project structure

```text
docs/<category>/      Guides, their tests, and _category.json
templates/            Page templates
assets/               Stylesheet and browser script
scripts/              Build, dev server, checks, test runner and topic collector
scripts/lib/rules/    One file per content check
tests/                Tests for the tooling, and helpers for guide tests
site.config.json      Title, address, allowed HTML and link domains
topics.config.json    Subjects and searches for the topic collector
.github/workflows/    Pull request checks and deployment to GitHub Pages
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licences

- Code: [MIT](LICENSE)
- Guides under `docs/`: [CC BY 4.0](LICENSE-content)
