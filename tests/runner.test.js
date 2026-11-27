import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { runGuide } from '../scripts/lib/runner.js';

const temps = [];
after(() => Promise.all(temps.map(dir => rm(dir, { recursive: true, force: true }))));

async function run(blocks, sidecar = 'setup() { :; }\nverify() { :; }') {
  const dir = await mkdtemp(path.join(tmpdir(), 'runner-'));
  temps.push(dir);
  const fences = blocks.map(([info, code]) => `\`\`\`${info}\n${code}\n\`\`\``).join('\n\n');
  await writeFile(path.join(dir, 'g.md'), `---\ntitle: T\n---\n\n## Do it\n\n${fences}\n`);
  await writeFile(path.join(dir, 'g.test.sh'), sidecar);
  return runGuide(path.join(dir, 'g.md'), path.join(dir, 'g.test.sh'));
}

test('runs bash blocks in order, with substitutions, and skips manual ones', async () => {
  const result = await run(
    [['bash', 'echo NAME > out'], ['bash manual="editor"', 'exit 1'], ['sh', 'grep -q value out'], ['json check=json', '{}']],
    'SUBSTITUTE=("NAME=value")\nsetup() { :; }\nverify() { assert_eq "$(cat out)" value; }');
  assert.deepEqual(result, { ok: true, dir: undefined, counts: { run: 2, json: 1, manual: 1 } });
});

test('git is isolated: fake home, no inherited config, no network remotes', async () => {
  const result = await run([['bash', [
    'case "$HOME" in "$TEST_ROOT"/*) ;; *) exit 1 ;; esac',
    'test "$(git config user.name)" = "Test Runner"',
    'git config --global probe.key yes',
    'grep -q probe "$HOME/.gitconfig"',
    '! git ls-remote https://example.com/repo.git 2> err',
    'grep -q "not allowed" err',
    'test -z "${SSH_AUTH_SOCK:-}"',
  ].join('\n')]]);
  assert.equal(result.error, undefined);
});

test('a failing block names the block, section and output', async () => {
  const result = await run([['bash', 'true'], ['bash', 'git no-such-command']]);
  assert.equal(result.ok, false);
  assert.match(result.error, /block 2 of 2, section "Do it" failed/);
  assert.match(result.error, /no-such-command' is not a git command/);
});

test('verify can check what each block printed', async () => {
  const result = await run([['bash manual="x"', 'true'], ['bash', 'echo found']],
    'setup() { :; }\nverify() { assert_eq "$(output_of 2)" found; }');
  assert.equal(result.error, undefined);
});

test('bad JSON, failed assertions and stale substitutions fail', async () => {
  assert.match((await run([['json check=json', '{,}']])).error, /not valid JSON/);
  assert.match((await run([], 'setup() { :; }\nverify() { assert_eq a b "letters"; }')).error, /letters: got 'a'/);
  assert.match((await run([['bash', 'true']], 'SUBSTITUTE=("gone=x")\nsetup() { :; }\nverify() { :; }')).error, /not found.*gone/);
  assert.match((await run([], 'setup() { :; }')).error, /define setup\(\) and verify\(\)/);
});
