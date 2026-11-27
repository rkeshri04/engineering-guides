/* Guide tests: `npm test`, `npm test -- <slug>`, `npm test -- --keep`. */
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { runGuide } from './lib/runner.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SUFFIX = '.test.sh';

async function sidecars() {
  const entries = await readdir(path.join(ROOT, 'docs'), { recursive: true, withFileTypes: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith(SUFFIX))
    .map(e => {
      const sidecar = path.join(e.parentPath, e.name);
      return { slug: e.name.slice(0, -SUFFIX.length), sidecar, guide: sidecar.slice(0, -SUFFIX.length) + '.md' };
    })
    .sort((a, b) => (a.slug < b.slug ? -1 : 1));
}

const { values, positionals } = parseArgs({ options: { keep: { type: 'boolean' } }, allowPositionals: true });
const all = await sidecars();
const selected = positionals.length ? all.filter(t => positionals.includes(t.slug)) : all;
const unknown = positionals.filter(slug => !all.some(t => t.slug === slug));

if (unknown.length) {
  console.error(`No test for: ${unknown.join(', ')}`);
  process.exit(1);
}

let failed = 0;
for (const test of selected) {
  const result = await runGuide(test.guide, test.sidecar, { keep: values.keep });
  if (result.ok) {
    const { run, json, manual } = result.counts;
    console.log(`PASS  ${test.slug}  (${run} blocks run, ${json} JSON checked, ${manual} marked manual)`);
  } else {
    failed++;
    console.log(`FAIL  ${test.slug}\n  ${path.relative(ROOT, test.guide)}: ${result.error}`);
  }
  if (result.dir) console.log(`  kept: ${result.dir}`);
}
console.log(`\n${selected.length - failed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
