/*
 * Collect guide topic candidates into topics/report.md (ignored by git).
 * `npm run topics [-- --subject git --days 365 --limit 8]` (limit is per source)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { exclude, rank } from './lib/topics/rank.js';
import { report } from './lib/topics/report.js';
import { collect } from './lib/topics/sources.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function positive(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw new Error(`--${name} must be a whole number above 0`);
  return number;
}

try {
  const { values } = parseArgs({
    options: {
      subject: { type: 'string', multiple: true },
      days: { type: 'string', default: '365' },
      limit: { type: 'string', default: '8' },
    },
  });
  const days = positive(values.days, 'days');
  const limit = positive(values.limit, 'limit');

  const config = JSON.parse(await readFile(path.join(ROOT, 'topics.config.json'), 'utf8'));
  const unknown = (values.subject ?? []).filter(id => !config.subjects.some(s => s.id === id));
  if (unknown.length) {
    throw new Error(`unknown subject ${unknown.join(', ')}; choose from ${config.subjects.map(s => s.id).join(', ')}`);
  }
  const subjects = config.subjects.filter(s => !values.subject || values.subject.includes(s.id));

  if (!process.env.GITHUB_TOKEN) console.log('No GITHUB_TOKEN set, so GitHub searches are spaced out. This takes a minute or two.');
  const now = Date.now();
  const { items, failures, succeeded } = await collect(subjects, {
    since: now - days * 86_400_000, env: process.env, progress: line => console.log(`  ${line}`),
  });
  for (const failure of failures) console.warn(`Failed: ${failure}`);
  // Keep the previous report rather than replacing it with an empty one.
  if (!succeeded) throw new Error('every search failed; no report written');

  const wanted = exclude(items, config.excludeTitles);
  const ranked = subjects.flatMap(s => rank(wanted.filter(i => i.subject === s.id), { now }));
  const text = report(subjects, ranked, { date: new Date(now).toISOString().slice(0, 10), days, limit, failures });
  await mkdir(path.join(ROOT, 'topics'), { recursive: true });
  await writeFile(path.join(ROOT, 'topics/report.md'), text);
  console.log(`\nWrote topics/report.md (${wanted.length} results)`);
} catch (error) {
  console.error(`Topics failed: ${error.message}`);
  process.exitCode = 1;
}
