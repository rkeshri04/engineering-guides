import { marked } from './vendor/marked.esm.js';

/* ------------------------------------------------------------------
   Icons
------------------------------------------------------------------ */
const ICON = {
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
};
const CALLOUT_ICON = { NOTE: ICON.note, TIP: ICON.note, IMPORTANT: ICON.note, WARNING: ICON.warning, CAUTION: ICON.warning };

const $ = (sel, root = document) => root.querySelector(sel);
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ------------------------------------------------------------------
   Front matter (small YAML subset: `key: value` and one level of nesting)
------------------------------------------------------------------ */
function parseFrontMatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: src };
  const data = {};
  let parent = null;
  const unquote = v => v.trim().replace(/^(['"])(.*)\1$/, '$2');
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const nested = line.match(/^\s+([^:]+):\s*(.*)$/);
    const top = line.match(/^([^\s:][^:]*):\s*(.*)$/);
    if (nested && parent) data[parent][nested[1].trim()] = unquote(nested[2]);
    else if (top) {
      if (top[2].trim() === '') { parent = top[1].trim(); data[parent] = {}; }
      else { parent = null; data[top[1].trim()] = unquote(top[2]); }
    }
  }
  return { data, body: src.slice(m[0].length) };
}

/* Heading attributes: `## Title {#id toc="Short label"}` */
const ATTR_RE = /\s*\{#([\w-]+)(?:\s+toc=(?:"|&quot;)(.*?)(?:"|&quot;))?\}\s*$/;

/* ------------------------------------------------------------------
   Syntax highlighting (deliberately minimal: strings, JSON keys, comments)
------------------------------------------------------------------ */
const SHELL = new Set(['bash', 'sh', 'shell', 'zsh', 'console']);
function highlight(code, lang) {
  const re = /("(?:\\.|[^"\\])*"|'[^']*')(\s*:)?|(^|[ \t])(#[^\n]*)/gm;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    if (m[1]) {
      const isKey = lang === 'json' && m[2];
      out += `<span class="${isKey ? 'tok-k' : 'tok-s'}">${esc(m[1])}</span>${m[2] ? esc(m[2]) : ''}`;
    } else if (SHELL.has(lang)) {
      out += esc(m[3]) + `<span class="tok-c">${esc(m[4])}</span>`;
    } else {
      out += esc(m[0]);
    }
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}

marked.use({
  gfm: true,
  renderer: {
    code({ text, lang = '' }) {
      const language = (lang.match(/^\S*/) || [''])[0].toLowerCase();
      const title = (lang.match(/title="([^"]+)"/) || [])[1];
      const label = esc(title || language || 'text');
      return `<div class="codeblock"><div class="codeblock-head"><span class="lang">${label}</span>` +
        `<button class="copy" type="button">${ICON.copy}<span>Copy</span></button></div>` +
        `<pre><code>${highlight(text.replace(/\n$/, ''), language)}</code></pre></div>`;
    },
  },
});

/* ------------------------------------------------------------------
   Markdown -> page structure
------------------------------------------------------------------ */
function buildArticle(body) {
  const tpl = document.createElement('div');
  tpl.innerHTML = marked.parse(body);

  // GitHub-style callouts:  > [!NOTE]
  tpl.querySelectorAll('blockquote').forEach(bq => {
    const first = bq.querySelector('p');
    const m = first && first.innerHTML.match(/^\s*\[!(\w+)\]\s*/);
    if (!m) return;
    first.innerHTML = first.innerHTML.slice(m[0].length);
    const note = document.createElement('div');
    note.className = 'note note-' + m[1].toLowerCase();
    const content = document.createElement('div');
    content.append(...bq.childNodes);
    note.innerHTML = CALLOUT_ICON[m[1].toUpperCase()] || ICON.note;
    note.append(content);
    bq.replaceWith(note);
  });

  tpl.querySelectorAll('table').forEach(t => t.classList.add('ref'));

  // Ordered lists become numbered steps; a bold-only first paragraph is the step title
  tpl.querySelectorAll('ol').forEach(ol => {
    ol.classList.add('steps');
    for (const li of ol.children) {
      const first = li.firstElementChild;
      const lead = first && first.tagName === 'P' ? first : null;
      if (lead && lead.children.length === 1 && lead.firstElementChild.tagName === 'STRONG' &&
          lead.textContent.trim() === lead.firstElementChild.textContent.trim()) {
        lead.className = 'step-title';
        lead.innerHTML = lead.firstElementChild.innerHTML;
      } else if (li.firstChild && li.firstChild.nodeName === 'STRONG') {
        const p = document.createElement('p');
        p.className = 'step-title';
        p.innerHTML = li.firstChild.innerHTML;
        li.firstChild.replaceWith(p);
      }
      li.querySelectorAll(':scope > ul').forEach(ul => ul.classList.add('sublist'));
    }
  });

  // Group content under each H2 into numbered sections
  const intro = document.createElement('div');
  const sections = [];
  let body_ = null;
  for (const node of [...tpl.childNodes]) {
    if (node.nodeName === 'H2') {
      const attrs = node.innerHTML.match(ATTR_RE);
      if (attrs) node.innerHTML = node.innerHTML.replace(ATTR_RE, '');
      const id = attrs ? attrs[1] : slugify(node.textContent);
      const toc = attrs && attrs[2] ? attrs[2].replace(/&amp;/g, '&') : node.textContent;

      const section = document.createElement('section');
      section.id = id;
      const head = document.createElement('div');
      head.className = 'section-head';
      head.innerHTML = `<span class="section-num">${String(sections.length + 1).padStart(2, '0')}</span>`;
      head.append(node);
      body_ = document.createElement('div');
      body_.className = 'section-body';
      section.append(head, body_);
      sections.push({ el: section, id, toc });
    } else if (body_) {
      body_.append(node);
    } else {
      intro.append(node);
    }
  }
  return { intro, sections };
}

function slugify(s) {
  return s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
}

/* Markdown for "Copy page": title + lede + body, without the heading attributes */
function toPlainMarkdown(data, body) {
  const clean = body.replace(/^(#{1,6} .*?)[ \t]*\{#[\w-]+(?:[ \t]+toc="[^"]*")?\}[ \t]*$/gm, '$1').trim();
  return [`# ${data.title || ''}`, data.lede, clean].filter(Boolean).join('\n\n') + '\n';
}

/* ------------------------------------------------------------------
   Clipboard
------------------------------------------------------------------ */
async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch {}
    ta.remove();
  }
}
function flashCopied(btn, idleLabel, doneLabel = 'Copied') {
  btn.classList.add('copied');
  btn.innerHTML = ICON.check + `<span>${doneLabel}</span>`;
  clearTimeout(btn._t);
  btn._t = setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = ICON.copy + `<span>${idleLabel}</span>`;
  }, 1600);
}

document.addEventListener('click', async e => {
  const btn = e.target.closest('.copy');
  if (!btn) return;
  await writeClipboard(btn.closest('.codeblock').querySelector('pre').innerText);
  flashCopied(btn, 'Copy');
});

/* ------------------------------------------------------------------
   App state, routing
------------------------------------------------------------------ */
const state = { manifest: null, guides: [], current: null, markdown: '' };
const main = $('#main');

function findGuide(param) {
  return state.guides.find(g => `${g.category.id}/${g.slug}` === param) || null;
}
function guideHref(g) { return `?doc=${g.category.id}/${g.slug}`; }
const HOME_HREF = location.pathname;

// In-app links (home, guide cards, menu items) navigate without a full reload
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-nav]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  closeMenu();
  const doc = a.dataset.doc || null;
  const currentDoc = new URLSearchParams(location.search).get('doc');
  if (doc === currentDoc && !location.hash) return window.scrollTo({ top: 0, behavior: 'smooth' });
  route(true, doc);
});

async function init() {
  try {
    const res = await fetch('docs/index.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    state.manifest = await res.json();
  } catch {
    return showError();
  }
  $('#site-title').textContent = state.manifest.title || 'Guides';
  state.guides = state.manifest.categories.flatMap(c => c.guides.map(g => ({ ...g, category: c })));
  buildMenu();
  await route(false);
  window.addEventListener('popstate', () => route(false));
}

async function route(push, param) {
  if (param === undefined) param = new URLSearchParams(location.search).get('doc');
  if (!param) {
    if (push) history.pushState(null, '', HOME_HREF);
    return renderHome();
  }
  const guide = findGuide(param);
  if (push) history.pushState(null, '', guide ? guideHref(guide) : `?doc=${param}`);
  if (!guide) return showNotFound();
  await loadGuide(guide);
}

/* ------------------------------------------------------------------
   Home: every category and guide
------------------------------------------------------------------ */
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function renderHome() {
  const m = state.manifest;
  state.current = null;
  document.body.classList.add('is-home');
  document.title = m.title || 'Guides';
  const total = state.guides.length;
  $('#topbar-meta').textContent = `${total} guide${total === 1 ? '' : 's'}`;
  updateMenuCurrent();

  main.innerHTML = `
    <div class="doc-head"><p class="eyebrow">Documentation</p></div>
    <h1>${esc(m.title || 'Guides')}</h1>
    ${m.description ? `<p class="lede">${esc(m.description)}</p>` : ''}
    </dl>`;

  const sections = m.categories.map((c, i) => {
    const el = document.createElement('section');
    el.id = c.id;
    el.innerHTML = `
      <div class="section-head">
        <span class="section-num">${String(i + 1).padStart(2, '0')}</span>
        <h2>${esc(c.name)}</h2>
      </div>
      <div class="section-body">
        ${c.description ? `<p class="category-desc">${esc(c.description)}</p>` : ''}
        <ul class="guide-list">
          ${c.guides.map(g => `
            <li>
              <a class="guide-card" href="?doc=${c.id}/${g.slug}" data-nav data-doc="${c.id}/${g.slug}">
                <span class="guide-text">
                  <span class="guide-title">${esc(g.title)}</span>
                  ${g.summary ? `<span class="guide-sub">${esc(g.summary)}</span>` : ''}
                </span>
                <span class="guide-end">
                  ${g.type ? `<span class="guide-type">${esc(g.type)}</span>` : ''}
                  <span class="guide-arrow">${ARROW}</span>
                </span>
              </a>
            </li>`).join('')}
        </ul>
      </div>`;
    return { el, id: c.id, toc: c.name };
  });
  sections.forEach(s => main.append(s.el));

  const footer = document.createElement('footer');
  footer.innerHTML = `<span>${esc(m.title || 'Guides')}</span><a href="#" data-top>Back to top ↑</a>`;
  main.append(footer);
  $('[data-top]', main).addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  $('.toc-label').textContent = 'Categories';
  buildToc(sections);
  window.scrollTo(0, 0);
  requestAnimationFrame(() => main.classList.remove('is-loading'));
  onScroll();
}

async function loadGuide(guide) {
  main.classList.add('is-loading');
  let src;
  try {
    const res = await fetch('docs/' + guide.file, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    src = await res.text();
  } catch {
    return showError();
  }
  const { data, body } = parseFrontMatter(src);
  const { intro, sections } = buildArticle(body);
  state.current = guide;
  state.markdown = toPlainMarkdown({ title: data.title || guide.title, lede: data.lede }, body);

  const title = data.title || guide.title;
  document.body.classList.remove('is-home');
  $('.toc-label').textContent = 'On this page';
  document.title = `${title} — ${state.manifest.title}`;
  $('#crumb-label').textContent = guide.category.name;
  $('#topbar-meta').textContent = `${data.type || 'Guide'} · ${sections.length} section${sections.length === 1 ? '' : 's'}`;
  updateMenuCurrent();

  const meta = data.meta && typeof data.meta === 'object'
    ? `<dl class="meta-row">${Object.entries(data.meta).map(([k, v]) =>
        `<div class="meta-item"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`
    : '';

  main.innerHTML = `
    <div class="doc-head">
      <p class="eyebrow">${esc(data.eyebrow || guide.category.name)}</p>
      <button class="page-copy" type="button" title="Copy page as Markdown" aria-label="Copy page as Markdown">${ICON.copy}<span>Copy page</span></button>
    </div>
    <h1>${esc(title)}</h1>
    ${data.lede ? `<p class="lede">${esc(data.lede)}</p>` : ''}
    ${meta}`;
  if (intro.childNodes.length) main.append(...intro.childNodes);
  sections.forEach(s => main.append(s.el));

  const footer = document.createElement('footer');
  footer.innerHTML = `<span>${esc(title)}</span><a href="#" data-top>Back to top ↑</a>`;
  main.append(footer);

  const pageCopy = $('.page-copy', main);
  pageCopy.addEventListener('click', async () => {
    await writeClipboard(state.markdown);
    flashCopied(pageCopy, 'Copy page');
  });
  $('[data-top]', main).addEventListener('click', e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  buildToc(sections);

  const hash = location.hash.slice(1);
  const target = hash && document.getElementById(hash);
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);

  requestAnimationFrame(() => main.classList.remove('is-loading'));
  onScroll();
}

function showError() {
  const local = location.protocol === 'file:';
  main.innerHTML = `<div class="state"><h2>Couldn't load the guides</h2>${local
    ? `<p>Browsers block loading files directly from disk. Serve this folder instead, for example:</p><p><code>python3 -m http.server</code> &nbsp;then open <code>http://localhost:8000</code></p>`
    : `<p>Check that <code>docs/index.json</code> and the guide file exist on the server.</p>`}</div>`;
  main.classList.remove('is-loading');
}
function showNotFound() {
  document.body.classList.add('is-home');
  main.innerHTML = `<div class="state"><h2>Guide not found</h2><p>That guide doesn't exist or has moved. <a href="${HOME_HREF}" data-nav>Browse all guides</a>.</p></div>`;
  $('#toc').innerHTML = '';
  tocSections = []; tocLinks = [];
  main.classList.remove('is-loading');
}

/* ------------------------------------------------------------------
   Table of contents + scroll progress
------------------------------------------------------------------ */
let tocLinks = [], tocSections = [];
const progress = $('#progress');

function buildToc(sections) {
  const toc = $('#toc');
  toc.innerHTML = sections.map(s => `<li><a href="#${s.id}">${esc(s.toc)}</a></li>`).join('');
  tocLinks = [...toc.querySelectorAll('a')];
  tocSections = sections.map(s => s.el);
}

function onScroll() {
  if (tocSections.length) {
    const y = window.scrollY + 120;
    let current = tocSections[0];
    tocSections.forEach(s => { if (s.offsetTop <= y) current = s; });
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) current = tocSections.at(-1);
    tocLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + current.id));
  }
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
}
window.addEventListener('scroll', onScroll, { passive: true });

/* ------------------------------------------------------------------
   Breadcrumb dropdown
------------------------------------------------------------------ */
const trigger = $('#crumb-trigger');
const popover = $('#crumb-popover');

function buildMenu() {
  popover.innerHTML = `
    <div class="pop-group">
      <a class="pop-item pop-item-home" role="menuitem" tabindex="-1" href="${HOME_HREF}" data-nav>
        <span class="pop-item-title">All guides</span>
        <span class="pop-arrow">${ARROW}</span>
      </a>
    </div>` + state.manifest.categories.map(c => `
    <div class="pop-group" role="group" aria-label="${esc(c.name)}">
      <div class="pop-label"><span>${esc(c.name)}</span><span>${c.guides.length}</span></div>
      ${c.guides.map(g => `
        <a class="pop-item" role="menuitem" tabindex="-1" href="?doc=${c.id}/${g.slug}" data-nav data-doc="${c.id}/${g.slug}">
          <span><span class="pop-item-title">${esc(g.title)}</span>${g.summary ? `<span class="pop-item-sub">${esc(g.summary)}</span>` : ''}</span>
          <span class="check">${ICON.check}</span>
        </a>`).join('')}
    </div>`).join('');
}

function updateMenuCurrent() {
  const key = state.current ? `${state.current.category.id}/${state.current.slug}` : null;
  popover.querySelectorAll('.pop-item').forEach(a => {
    if (a.dataset.doc === key) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

const items = () => [...popover.querySelectorAll('.pop-item')];

function openMenu(focusFirst = false) {
  popover.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => popover.classList.add('open'));
  const list = items();
  const target = list.find(a => a.getAttribute('aria-current')) || list[0];
  if (focusFirst && target) target.focus();
}
function closeMenu(returnFocus = false) {
  if (popover.hidden) return;
  popover.classList.remove('open');
  trigger.setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (trigger.getAttribute('aria-expanded') === 'false') popover.hidden = true; }, 140);
  if (returnFocus) trigger.focus();
}

trigger.addEventListener('click', () => (popover.hidden ? openMenu() : closeMenu()));
trigger.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    openMenu(true);
  }
});

popover.addEventListener('keydown', e => {
  const list = items();
  const i = list.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); list[(i + 1) % list.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
  else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); list.at(-1).focus(); }
  else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
  else if (e.key === 'Tab') closeMenu();
});

document.addEventListener('pointerdown', e => {
  if (!popover.hidden && !e.target.closest('#crumb-menu')) closeMenu();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

init();
