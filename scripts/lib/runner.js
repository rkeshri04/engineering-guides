/*
 * Runs a guide's own code blocks in a throwaway directory. The sidecar
 * `<slug>.test.sh` only sets up the problem and checks the result.
 *
 * Isolation: a fresh environment, a fake $HOME, no system git config, and git
 * may only talk to local paths. This is NOT a security boundary: a block can
 * still reach anything the current user can.
 * TODO: run inside a container before testing guides from outside contributors.
 */
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { codeBlocks } from './blocks.js';

const LIB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../tests/lib.sh');
const TIMEOUT_MS = 60_000;

const GITCONFIG = `[user]
\tname = Test Runner
\temail = runner@example.com
[init]
\tdefaultBranch = main
`;

/* Built from scratch: nothing of the real user's environment is inherited. */
function isolatedEnv(root) {
  const home = path.join(root, 'home');
  return {
    PATH: process.env.PATH,
    HOME: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    CLAUDE_CONFIG_DIR: path.join(home, '.claude'),
    TMPDIR: path.join(root, 'tmp'),
    LANG: 'C',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: path.join(home, '.gitconfig'),
    GIT_CEILING_DIRECTORIES: root,
    GIT_ALLOW_PROTOCOL: 'file',
    GIT_TERMINAL_PROMPT: '0',
    GIT_EDITOR: 'false', // an editor opening is a failure, never a hang
    GIT_PAGER: 'cat',
    PAGER: 'cat',
    TEST_ROOT: root,
    WORKDIR: path.join(root, 'work'),
    ORIGIN: path.join(root, 'origin.git'),
  };
}

function bash(args, env, cwd = env.WORKDIR) {
  const result = spawnSync('bash', ['-euo', 'pipefail', ...args], {
    cwd, env, encoding: 'utf8', input: '', timeout: TIMEOUT_MS,
  });
  const ok = result.status === 0;
  const detail = result.error?.message ?? (result.stderr.trim() || result.stdout.trim() || `exit status ${result.status}`);
  return { ok, stdout: result.stdout ?? '', detail };
}

/* Run a function (or snippet) with the helpers and the sidecar loaded. */
const withSidecar = (sidecar, script, env) =>
  bash(['-c', `source "$1"; source "$2"; cd "$WORKDIR"; ${script}`, 'sidecar', LIB, sidecar], env);

const indent = text => text.split('\n').map(line => `    ${line}`).join('\n');

function substitute(blocks, pairs) {
  const unused = new Set(pairs.map(([from]) => from));
  const scripts = blocks.map(block => pairs.reduce((text, [from, to]) => {
    if (!text.includes(from)) return text;
    unused.delete(from);
    return text.replaceAll(from, () => to);
  }, block.text));
  return { scripts, unused: [...unused] };
}

async function steps(guide, sidecar, env) {
  const blocks = codeBlocks(await readFile(guide, 'utf8'));
  const runnable = blocks.filter(b => b.run);

  const declared = withSidecar(sidecar,
    'declare -F setup verify >/dev/null || fail "define setup() and verify()"; printf "%s\\0" ${SUBSTITUTE[@]+"${SUBSTITUTE[@]}"}', env);
  if (!declared.ok) throw new Error(`could not load the test file:\n${indent(declared.detail)}`);
  const pairs = declared.stdout.split('\0').filter(Boolean).map(entry => {
    const at = entry.indexOf('=');
    if (at < 1) throw new Error(`SUBSTITUTE entry is not "from=to": ${entry}`);
    return [entry.slice(0, at), entry.slice(at + 1)];
  });
  const { scripts, unused } = substitute(runnable, pairs);
  if (unused.length) throw new Error(`SUBSTITUTE text not found in any runnable block: ${unused.join(', ')}`);

  const setup = withSidecar(sidecar, 'setup', env);
  if (!setup.ok) throw new Error(`setup() failed:\n${indent(setup.detail)}`);

  const where = block => `block ${block.number} of ${blocks.length}, section "${block.section}"`;
  for (const [i, block] of runnable.entries()) {
    const file = path.join(env.TEST_ROOT, 'blocks', `${block.number}.sh`);
    await writeFile(file, `${scripts[i]}\n`);
    const result = bash([file], env);
    // So that verify() can check what a command printed: see output_of.
    await writeFile(path.join(env.TEST_ROOT, 'blocks', `${block.number}.out`), result.stdout);
    if (!result.ok) throw new Error(`${where(block)} failed:\n${indent(scripts[i])}\n  output:\n${indent(result.detail)}`);
  }
  for (const block of blocks.filter(b => b.json)) {
    try {
      JSON.parse(block.text);
    } catch (error) {
      throw new Error(`${where(block)} is not valid JSON: ${error.message}`);
    }
  }

  const verify = withSidecar(sidecar, 'verify', env);
  if (!verify.ok) throw new Error(`verify() failed:\n${indent(verify.detail)}`);

  return { run: runnable.length, json: blocks.filter(b => b.json).length, manual: blocks.filter(b => b.manual).length };
}

/** Test one guide. Returns { ok, counts | error, dir (only when kept) }. */
export async function runGuide(guide, sidecar, { keep = false } = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'guide-test-')));
  const env = isolatedEnv(root);
  try {
    for (const dir of [env.HOME, env.TMPDIR, env.WORKDIR, path.join(root, 'blocks'), path.join(root, 'state')]) {
      await mkdir(dir, { recursive: true });
    }
    await writeFile(env.GIT_CONFIG_GLOBAL, GITCONFIG);
    const repos = bash(['-c', 'git init -q --bare "$ORIGIN"; git init -q "$WORKDIR"; git -C "$WORKDIR" remote add origin "$ORIGIN"'], env, root);
    if (!repos.ok) throw new Error(`could not create the test repositories:\n${indent(repos.detail)}`);
    return { ok: true, counts: await steps(guide, sidecar, env), dir: keep ? root : undefined };
  } catch (error) {
    return { ok: false, error: error.message, dir: keep ? root : undefined };
  } finally {
    if (!keep) await rm(root, { recursive: true, force: true });
  }
}
