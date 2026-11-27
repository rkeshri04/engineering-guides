import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.js';
import { loadContent } from './content.js';
import { assertNoInternalLeaks } from './leaks.js';
import { guidePage, homePage, notFoundPage } from './pages.js';

const TEMPLATES = {
  home: 'home.html',
  page: 'page.html',
  404: '404.html',
  head: 'partials/head.html',
  topbar: 'partials/topbar.html',
};

/* Relative `.md` links point at other guides; root-relative links get the base path. */
function linkResolver(config, guides, guide) {
  return href => {
    if (href.startsWith('/') && !href.startsWith('//')) return config.basePath + href.slice(1);
    const m = href.match(/^([^:#?]+\.md)(#.*)?$/);
    if (!m) return href;
    const from = guide.source.split('/').slice(1, -1).join('/');
    const target = path.posix.join(from, m[1]).slice(0, -3);
    if (!guides.has(target)) throw new Error(`link to a guide that is not in this build: ${href}`);
    return `${config.basePath}${target}/${m[2] ?? ''}`;
  };
}

/**
 * Render the whole site in memory: Map of output path -> content.
 * Deterministic: the same input files give the same bytes.
 */
export async function renderSite(root, options = {}) {
  const config = await loadConfig(root);
  const categories = await loadContent(root, options);
  const read = file => readFile(path.join(root, file), 'utf8');

  const templates = {};
  for (const [name, file] of Object.entries(TEMPLATES)) templates[name] = await read(`templates/${file}`);

  const files = new Map([
    ['index.html', homePage(config, templates, categories)],
    ['404.html', notFoundPage(config, templates, categories)],
    ['assets/styles.css', await read('assets/styles.css')],
    ['assets/app.js', await read('assets/app.js')],
  ]);

  const guides = new Set(categories.flatMap(c => c.guides.map(g => `${c.id}/${g.slug}`)));
  const problems = [];
  for (const category of categories) {
    for (const guide of category.guides) {
      try {
        const { html, markdown } = guidePage(config, templates, categories, category, guide,
          linkResolver(config, guides, guide));
        files.set(`${category.id}/${guide.slug}/index.html`, html);
        files.set(`${category.id}/${guide.slug}.md`, markdown);
      } catch (error) {
        problems.push(`${guide.source}: ${error.message}`);
      }
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));

  if (!options.includeInternal) {
    const publicNames = categories.flatMap(c => c.guides.flatMap(g => [g.slug, g.title]));
    await assertNoInternalLeaks(root, files, publicNames);
  }
  return { config, files };
}
