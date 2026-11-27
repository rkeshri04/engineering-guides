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

async function readCategory(file, label, problems) {
  let data;
  try {
    data = JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    problems.push(`${label}: ${error.code === 'ENOENT' ? 'category folder has no _category.json' : error.message}`);
    return null;
  }
  if (typeof data?.name !== 'string' || !data.name.trim()) problems.push(`${label}: "name" is required`);
  if (data?.description !== undefined && typeof data.description !== 'string') problems.push(`${label}: "description" must be a string`);
  if (data?.order !== undefined && !Number.isFinite(data.order)) problems.push(`${label}: "order" must be a number`);
  return data;
}

/**
 * Load categories and guides. Only the folders a mode asks for are ever read:
 * internal/ is not opened unless includeInternal is set.
 * Throws one error listing every `file: problem`.
 */
export async function loadContent(root, { drafts = false, includeInternal = false } = {}) {
  const sources = [{ dir: 'docs' }];
  if (drafts) sources.push({ dir: 'drafts', draft: true });
  if (includeInternal) sources.push({ dir: 'internal', internal: true });

  const problems = [];
  const categories = new Map();
  const slugs = new Map();

  for (const source of sources) {
    for (const folder of await entries(path.join(root, source.dir))) {
      const rel = `${source.dir}/${folder.name}`;
      if (folder.isSymbolicLink()) { problems.push(`${rel}: symbolic links are not allowed`); continue; }
      if (!folder.isDirectory()) {
        if (folder.name.endsWith('.md')) problems.push(`${rel}: guides must live in a category folder`);
        continue;
      }
      if (!NAME_RE.test(folder.name) || RESERVED.has(folder.name)) {
        problems.push(`${rel}: not a usable category name (lowercase-with-hyphens; not ${[...RESERVED].join(' or ')})`);
        continue;
      }

      const files = await entries(path.join(root, rel));
      let category = categories.get(folder.name);
      const hasMeta = files.some(f => f.name === '_category.json');
      if (!category || hasMeta && source.dir === 'docs') {
        const data = await readCategory(path.join(root, rel, '_category.json'), `${rel}/_category.json`, problems);
        if (!data) continue;
        category = { id: folder.name, name: data.name, description: data.description, order: data.order, guides: [] };
        categories.set(folder.name, category);
      }

      for (const file of files) {
        const label = `${rel}/${file.name}`;
        if (file.isSymbolicLink()) { problems.push(`${label}: symbolic links are not allowed`); continue; }
        if (file.isDirectory()) { problems.push(`${label}: nested folders are not supported`); continue; }
        if (!file.name.endsWith('.md')) continue;

        const slug = file.name.slice(0, -3);
        const { data, body, problems: found } = readGuide(await readFile(path.join(root, label), 'utf8'));
        if (!NAME_RE.test(slug)) found.push('file name must be lowercase-with-hyphens');
        if (slugs.has(slug)) found.push(`duplicate slug, also used by ${slugs.get(slug)}`);
        slugs.set(slug, label);
        if (found.length) { problems.push(...found.map(p => `${label}: ${p}`)); continue; }

        const draft = Boolean(source.draft) || data.status === 'draft';
        if (draft && !drafts) continue;
        category.guides.push({ ...data, slug, body, draft, source: label, order: data.order });
      }
    }
  }

  if (problems.length) throw new Error(problems.join('\n'));

  const list = [...categories.values()].filter(c => c.guides.length).sort(byOrder('id'));
  for (const category of list) category.guides.sort(byOrder('slug'));
  return list;
}
