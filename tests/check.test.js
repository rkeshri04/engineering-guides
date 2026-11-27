import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runChecks } from '../scripts/lib/check.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOW = new Date('2026-12-01T00:00:00Z');
const temps = [];
after(() => Promise.all(temps.map(dir => rm(dir, { recursive: true, force: true }))));

/* A throwaway site: the real templates and config around fixture content. */
async function site(fixture) {
  const dir = await mkdtemp(path.join(tmpdir(), 'check-'));
  temps.push(dir);
  for (const item of ['site.config.json', 'templates', 'assets']) {
    await cp(path.join(ROOT, item), path.join(dir, item), { recursive: true });
  }
  await cp(path.join(ROOT, 'tests/fixtures', fixture, 'docs'), path.join(dir, 'docs'), { recursive: true });
  return dir;
}

/* "file:line RULE" for the line of `file` that contains `text`. */
async function at(dir, file, text, rule) {
  const lines = (await readFile(path.join(dir, file), 'utf8')).split('\n');
  const index = lines.findIndex(line => line.includes(text));
  assert.notEqual(index, -1, `fixture ${file} has no line with ${text}`);
  return `${file}:${index + 1} ${rule}`;
}

const keys = findings => new Set(findings.map(f => `${f.file}:${f.line} ${f.rule}`));

test('every violation in the bad fixtures is reported at its line', async () => {
  const dir = await site('bad');
  const found = keys(await runChecks(dir, { now: NOW }));
  const unsafe = 'docs/git/unsafe-content.md';
  const front = 'docs/git/bad-front-matter.md';
  const blocks = 'docs/git/unlabelled-blocks.md';
  const expected = [
    [unsafe, '<!--', 'HTML_COMMENT'],
    [unsafe, '<img', 'RAW_HTML'],
    [unsafe, '<div>a block', 'RAW_HTML'],
    [unsafe, '[//]:', 'HIDDEN_TEXT'],
    [unsafe, 'words nobody sees', 'HIDDEN_TEXT'],
    [unsafe, 'internal/runbook', 'INTERNAL_REF'],
    [unsafe, 'unlisted.example.net', 'LINK_DOMAIN'],
    [unsafe, 'install.sh | sh', 'RISKY_COMMAND'],
    [unsafe, 'wget -qO-', 'RISKY_COMMAND'],
    [unsafe, 'base64 -d', 'RISKY_COMMAND'],
    [unsafe, 'eval "', 'RISKY_COMMAND'],
    [unsafe, 'rm -rf ~/', 'RISKY_COMMAND'],
    [unsafe, 'sudo -E bash', 'RISKY_COMMAND'],
    [unsafe, 'authorized_keys', 'RISKY_COMMAND'],
    [unsafe, 'verified:', 'STALE_VERIFICATION'],
    [front, 'type:', 'FRONT_MATTER'],
    [front, 'verified:', 'FRONT_MATTER'],
    [front, '---', 'FRONT_MATTER'], // missing summary
    [blocks, '```json', 'UNLABELLED_BLOCK'],
    [blocks, 'manual=""', 'UNLABELLED_BLOCK'],
    [blocks, 'check=yaml', 'UNLABELLED_BLOCK'],
  ];
  for (const [file, text, rule] of expected) {
    const key = await at(dir, file, text, rule);
    assert.ok(found.has(key), `missing ${key}`);
  }
  assert.ok(found.has('docs/other/unsafe-content.md:1 DUPLICATE_SLUG'), 'duplicate slug');
  assert.ok(found.has('docs/orphan/_category.json:1 CATEGORY'), 'category without _category.json');
  assert.ok(!found.has(await at(dir, blocks, '```bash', 'UNLABELLED_BLOCK')), 'bash blocks are runnable');
});

test('look-alikes in the clean fixture are not reported', async () => {
  assert.deepEqual(await runChecks(await site('clean'), { now: NOW }), []);
});

// Built from code points, so no file in the repository holds these characters.
const HIDDEN = [
  0x00, 0x07, 0x1b, 0x7f, 0x85, 0xad, 0x34f, 0x200b, 0x200c, 0x200d, 0x200e, 0x2028, 0x202a, 0x202e, 0x2060,
  0x2066, 0x2069, 0x3164, 0xfeff, 0xe000, 0xe0001, 0xe0041, 0xe007f, 0xe0100, 0xe01ef,
];

async function invisible(content) {
  const dir = await site('clean');
  await writeFile(path.join(dir, 'docs/git/probe.md'), content);
  return (await runChecks(dir, { now: NOW })).filter(f => f.rule === 'INVISIBLE_CHAR');
}
const guide = (body, front = 'summary: S.') => `---\ntitle: Probe\n${front}\ntype: How-to\n---\n\n${body}\n`;

test('each invisible or deceptive character is an error', async () => {
  const body = HIDDEN.map(code => `word${String.fromCodePoint(code)}word`).join('\n');
  const found = await invisible(guide(body));
  assert.deepEqual(found.map(f => f.line), HIDDEN.map((_, i) => 7 + i));
  assert.ok(found.every(f => f.severity === 'error' && f.file === 'docs/git/probe.md'));
});

test('variation selector payloads, references and escapes are caught', async () => {
  assert.equal((await invisible(guide(`a${String.fromCodePoint(0xfe01)}`))).length, 1, 'selector after ASCII');
  assert.equal((await invisible(guide(`❤${String.fromCodePoint(0xfe0f, 0xfe0f)}`))).length, 1, 'stacked selectors');
  assert.equal((await invisible(guide('a&#x200B;b'))).length, 1, 'numeric reference');
  assert.equal((await invisible(guide('a&zwj;b'))).length, 1, 'named reference');
  assert.equal((await invisible(guide('Text.', 'summary: "S\\u200B."'))).length, 1, 'YAML escape');
  assert.equal((await invisible(guide('Line.\r\nAnother.\r'))).length, 0, 'Windows line endings are fine');
});
