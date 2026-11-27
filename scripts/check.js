/* Content and safety checks. Errors exit non-zero; warnings only print. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runChecks } from './lib/check.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const findings = await runChecks(ROOT);
  const of = severity => findings.filter(f => f.severity === severity);
  for (const severity of ['error', 'warning']) {
    const list = of(severity);
    if (!list.length) continue;
    console.log(`${severity === 'error' ? 'Errors' : 'Warnings'}:`);
    for (const f of list) console.log(`${f.file}:${f.line}  ${f.rule}  ${f.message}`);
    console.log('');
  }
  console.log(`${of('error').length} errors, ${of('warning').length} warnings`);
  if (of('error').length) process.exitCode = 1;
} catch (error) {
  console.error(`Check could not run: ${error.message}`);
  process.exitCode = 1;
}
