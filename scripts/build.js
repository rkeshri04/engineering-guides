import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { renderSite } from './lib/site.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Build into dist/, or dist-internal/ when internal guides are included. */
export async function build({ drafts = false, includeInternal = false } = {}) {
  const outDir = path.join(ROOT, includeInternal ? 'dist-internal' : 'dist');
  // Remove old output first, so a failed build never leaves a stale site to deploy.
  await rm(outDir, { recursive: true, force: true });
  const { config, files } = await renderSite(ROOT, { drafts, includeInternal });
  for (const [file, content] of files) {
    const target = path.join(outDir, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  }
  return { config, outDir, count: files.size };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({
      options: { drafts: { type: 'boolean' }, 'include-internal': { type: 'boolean' } },
    });
    const { config, outDir, count } = await build({ drafts: values.drafts, includeInternal: values['include-internal'] });
    console.log(`Built ${count} files into ${path.relative(ROOT, outDir)}/ (base path ${config.basePath})`);
  } catch (error) {
    console.error(`Build failed:\n${error.message}`);
    process.exitCode = 1;
  }
}
