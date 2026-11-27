import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { readGuide } from './front-matter.js';

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RESERVED = new Set(['assets', 'internal']);

async function entries(dir) {
  try {
    const list = await readdir(dir, { withFileTypes: true });
    return list.filter(e => !e.name.startsWith('.')).sort((a, b) => compare(a.name, b.name));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const byOrder = key => (a, b) =>
  (a.order ?? Infinity) - (b.order ?? Infinity) || compare(a[key], b[key]) || 0;

/* The line a front matter problem refers to: the quoted key, or YAML's own line. */
function problemLine(text, message) {
  const key = message.match(/"(\w+)"/)?.[1];
  const at = key ? text.split('\n').findIndex(line => line.startsWith(`${key}:`)) : -1;
  if (at >= 0) return at + 1;
  const yamlLine = message.match(/at line (\d+)/)?.[1];
  return yamlLine ? Number(yamlLine) + 1 : 1;
}

async function readCategory(file, label, report) {
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    report(label, error.code === 'ENOENT' ? 'category folder has no _category.json' : error.message, 'CATEGORY');
    return null;
  }
  if (typeof data?.name !== 'string' || !data.name.trim()) report(label, '"name" is required', 'CATEGORY');
  if (data?.description !== undefined && typeof data.description !== 'string') report(label, '"description" must be a string', 'CATEGORY');
  if (data?.order !== undefined && !Number.isFinite(data.order)) report(label, '"order" must be a number', 'CATEGORY');
  return data;
}

/**
 * Load categories and guides. Only the folders a mode asks for are ever read:
 * internal/ is not opened unless includeInternal is set.
 * Throws one error listing every `file: problem`; `error.problems` has them as
 * { file, line, rule, message } for the content checks.
 */
export async function loadContent(root, { drafts = false, includeInternal = false } = {}) {
  const sources = [{ dir: 'docs' }];
  if (drafts) sources.push({ dir: 'drafts', draft: true });
  if (includeInternal) sources.push({ dir: 'internal', internal: true });

  const problems = [];
  const report = (file, message, rule = 'STRUCTURE', line = 1) => problems.push({ file, line, rule, message });
  const categories = new Map();
  const slugs = new Map();

  for (const source of sources) {
    for (const folder of await entries(path.join(root, source.dir))) {
      const rel = `${source.dir}/${folder.name}`;
      if (folder.isSymbolicLink()) { report(rel, 'symbolic links are not allowed'); continue; }
      if (!folder.isDirectory()) {
        if (folder.name.endsWith('.md')) report(rel, 'guides must live in a category folder');
        continue;
      }
      if (!NAME_RE.test(folder.name) || RESERVED.has(folder.name)) {
        report(rel, `not a usable category name (lowercase-with-hyphens; not ${[...RESERVED].join(' or ')})`);
        continue;
      }

      const files = await entries(path.join(root, rel));
      let category = categories.get(folder.name);
      const hasMeta = files.some(f => f.name === '_category.json');
      if (!category || hasMeta && source.dir === 'docs') {
        const data = await readCategory(path.join(root, rel, '_category.json'), `${rel}/_category.json`, report);
        if (!data) continue;
        category = { id: folder.name, name: data.name, description: data.description, order: data.order, guides: [] };
        categories.set(folder.name, category);
      }

      for (const file of files) {
        const label = `${rel}/${file.name}`;
        if (file.isSymbolicLink()) { report(label, 'symbolic links are not allowed'); continue; }
        if (file.isDirectory()) { report(label, 'nested folders are not supported'); continue; }
        if (!file.name.endsWith('.md')) continue;

        const slug = file.name.slice(0, -3);
        const text = await readFile(path.join(root, label), 'utf8');
        const { data, body, problems: found } = readGuide(text);
        let valid = found.length === 0;
        for (const message of found) report(label, message, 'FRONT_MATTER', problemLine(text, message));
        if (!NAME_RE.test(slug)) { report(label, 'file name must be lowercase-with-hyphens'); valid = false; }
        if (slugs.has(slug)) { report(label, `duplicate slug, also used by ${slugs.get(slug)}`, 'DUPLICATE_SLUG'); valid = false; }
        slugs.set(slug, label);
        if (!valid) continue;

        const draft = Boolean(source.draft) || data.status === 'draft';
        if (draft && !drafts) continue;
        const hasTest = files.some(f => f.name === `${slug}.test.sh`);
        category.guides.push({ ...data, slug, body, draft, hasTest, source: label, order: data.order });
      }
    }
  }

  if (problems.length) {
    const error = new Error(problems.map(p => `${p.file}: ${p.message}`).join('\n'));
    throw Object.assign(error, { problems });
  }

  const list = [...categories.values()].filter(c => c.guides.length).sort(byOrder('id'));
  for (const category of list) category.guides.sort(byOrder('slug'));
  return list;
}
