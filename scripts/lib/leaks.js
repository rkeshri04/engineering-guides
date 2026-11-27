import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { splitFrontMatter } from './front-matter.js';

const INTERNAL_PATH = /(?<![A-Za-z0-9_-])internal\//i;

/**
 * Names that identify local internal guides: distinctive file names and titles.
 * Reads internal/ only to know what must NOT appear in public output.
 */
async function internalNames(root) {
  const names = new Set();
  let files;
  try {
    files = await readdir(path.join(root, 'internal'), { recursive: true, withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return names;
    throw error;
  }
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue;
    const stem = file.name.slice(0, -3);
    if (stem.includes('-') && stem.length >= 8) names.add(stem.toLowerCase());
    const { yaml } = splitFrontMatter(await readFile(path.join(file.parentPath, file.name), 'utf8'));
    const title = yaml?.match(/^title:[ \t]*(['"]?)(.+?)\1[ \t]*$/m)?.[2];
    if (title && title.length >= 8) names.add(title.toLowerCase());
  }
  return names;
}

/**
 * Throw if any public output refers to internal content.
 * `files` maps output path -> content; `publicNames` are exempt from name matching.
 */
export async function assertNoInternalLeaks(root, files, publicNames = []) {
  const names = await internalNames(root);
  for (const name of publicNames) names.delete(name.toLowerCase());

  const problems = [];
  for (const [file, content] of files) {
    const text = `${file}\n${content}`;
    if (INTERNAL_PATH.test(text)) problems.push(`${file}: refers to an internal/ path`);
    const lower = text.toLowerCase();
    // The matched name is not printed: build logs are public in CI.
    if ([...names].some(name => lower.includes(name))) problems.push(`${file}: mentions an internal guide`);
  }
  if (problems.length) throw new Error(`internal content in public output:\n${problems.join('\n')}`);
}
