import { esc, escText, fill } from './html.js';
import { ICON } from './icons.js';
import { renderArticle, toCleanMarkdown } from './markdown.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const guidePath = (config, category, guide) => `${config.basePath}${category.id}/${guide.slug}/`;
const draftTag = (guide, label) => (guide.draft ? `Draft · ${label}` : label);

/* ---------- shared chrome ---------- */

function menu(config, categories, currentSlug) {
  const home = `
    <div class="pop-group">
      <a class="pop-item pop-item-home" role="menuitem" tabindex="-1" href="${esc(config.basePath)}">
        <span class="pop-item-title">All guides</span>
        <span class="pop-arrow">${ICON.arrow}</span>
      </a>
    </div>`;
  const groups = categories.map(c => `
    <div class="pop-group" role="group" aria-label="${esc(c.name)}">
      <div class="pop-label"><span>${esc(c.name)}</span><span>${c.guides.length}</span></div>${c.guides.map(g => `
      <a class="pop-item" role="menuitem" tabindex="-1" href="${esc(guidePath(config, c, g))}"${g.slug === currentSlug ? ' aria-current="page"' : ''}>
        <span><span class="pop-item-title">${esc(draftTag(g, g.title))}</span><span class="pop-item-sub">${esc(g.summary)}</span></span>
        <span class="check">${ICON.check}</span>
      </a>`).join('')}
    </div>`);
  return home + groups.join('');
}

const toc = items => items.map(s => `<li><a href="#${esc(s.id)}">${esc(s.toc)}</a></li>`).join('');

const footer = title => `<footer><span>${esc(title)}</span><a href="#" data-top>Back to top ↑</a></footer>`;

function head(config, { title, description, path, type = 'website', markdown, noindex }) {
  const lines = [];
  if (path !== undefined) {
    const url = esc(config.siteUrl + path);
    lines.push(
      `<link rel="canonical" href="${url}">`,
      `<meta property="og:type" content="${type}">`,
      `<meta property="og:title" content="${esc(title)}">`,
      `<meta property="og:description" content="${esc(description)}">`,
      `<meta property="og:url" content="${url}">`,
      `<meta property="og:site_name" content="${esc(config.title)}">`,
    );
  }
  if (markdown) lines.push(`<link rel="alternate" type="text/markdown" href="${esc(markdown)}">`);
  if (noindex) lines.push('<meta name="robots" content="noindex">');
  return lines.join('\n');
}

function page(config, templates, name, categories, values) {
  const shared = {
    siteTitle: esc(config.title),
    base: esc(config.basePath),
    menu: menu(config, categories, values.currentSlug),
    crumbLabel: '&nbsp;',
    topbarMeta: '',
    toc: '',
  };
  const expanded = templates[name].replace(/\{\{> (\w+)\}\}\n?/g, (_, partial) => templates[partial]);
  return fill(expanded, { ...shared, ...values });
}

/* ---------- pages ---------- */

export function homePage(config, templates, categories) {
  const total = categories.reduce((n, c) => n + c.guides.length, 0);
  const sections = categories.map((c, i) => `
<section id="${esc(c.id)}">
  <div class="section-head">
    <span class="section-num">${String(i + 1).padStart(2, '0')}</span>
    <h2>${esc(c.name)}</h2>
  </div>
  <div class="section-body">
    ${c.description ? `<p class="category-desc">${esc(c.description)}</p>` : ''}
    <ul class="guide-list">${c.guides.map(g => `
      <li>
        <a class="guide-card" href="${esc(guidePath(config, c, g))}">
          <span class="guide-text">
            <span class="guide-title">${esc(g.title)}</span>
            <span class="guide-sub">${esc(g.summary)}</span>
          </span>
          <span class="guide-end">
            <span class="guide-type">${esc(draftTag(g, g.type))}</span>
            <span class="guide-arrow">${ICON.arrow}</span>
          </span>
        </a>
      </li>`).join('')}
    </ul>
  </div>
</section>`).join('');

  return page(config, templates, 'home', categories, {
    title: esc(config.title),
    description: esc(config.description),
    head: head(config, { title: config.title, description: config.description, path: config.basePath }),
    topbarMeta: plural(total, 'guide'),
    toc: toc(categories.map(c => ({ id: c.id, toc: c.name }))),
    heading: esc(config.title),
    lede: config.lede ? `<p class="lede">${esc(config.lede)}</p>` : '',
    sections,
    footer: footer(config.title),
  });
}

export function guidePage(config, templates, categories, category, guide, resolveLink) {
  const { intro, sections } = renderArticle(guide.body, { allowedHtml: config.allowedHtml, resolveLink });
  const markdown = toCleanMarkdown(guide, guide.body);
  const path = guidePath(config, category, guide);
  const meta = Object.entries(guide.meta ?? {});

  const html = page(config, templates, 'page', categories, {
    currentSlug: guide.slug,
    title: esc(`${guide.title} — ${config.title}`),
    description: esc(guide.summary),
    head: head(config, {
      title: guide.title,
      description: guide.summary,
      path,
      type: 'article',
      markdown: `${config.basePath}${category.id}/${guide.slug}.md`,
      noindex: guide.draft,
    }),
    crumbLabel: esc(category.name),
    topbarMeta: escText(`${guide.type} · ${plural(sections.length, 'section')}`),
    toc: toc(sections),
    eyebrow: esc(draftTag(guide, guide.eyebrow || category.name)),
    copyIcon: ICON.copy,
    heading: esc(guide.title),
    lede: guide.lede ? `<p class="lede">${esc(guide.lede)}</p>` : '',
    meta: meta.length
      ? `<dl class="meta-row">${meta.map(([k, v]) => `<div class="meta-item"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
      : '',
    body: intro + sections.map(s => s.html).join('\n'),
    footer: footer(guide.title),
    // `<` is escaped so the Markdown can never close the script element.
    markdownJson: JSON.stringify(markdown).replace(/</g, '\\u003c'),
  });

  return { html, markdown };
}

export function notFoundPage(config, templates, categories) {
  return page(config, templates, '404', categories, {
    title: esc(`Guide not found — ${config.title}`),
    description: esc(config.description),
    head: head(config, { noindex: true }),
  });
}
