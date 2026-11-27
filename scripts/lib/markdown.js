import { Marked, Renderer } from 'marked';
import { parseInfo } from './fence.js';
import { highlight } from './highlight.js';
import { esc, escText, textOf } from './html.js';
import { CALLOUT_ICON, ICON } from './icons.js';

/* Heading attributes: `## Title {#id toc="Short label"}` */
const ATTR_RE = /\s*\{#([\w-]+)(?:\s+toc=(?:"|&quot;)(.*?)(?:"|&quot;))?\}\s*$/;
const SAFE_SCHEMES = new Set(['http', 'https', 'mailto']);
/* Ids the page templates already use; a section with one would break the page. */
const PAGE_IDS = ['site-title', 'crumb-menu', 'crumb-label', 'crumb-trigger', 'crumb-popover',
  'topbar-meta', 'progress', 'toc', 'main', 'page-markdown', 'ai-trigger', 'ai-popover'];

function codeBlock({ text, lang: info = '' }) {
  const { lang, attrs } = parseInfo(info);
  const label = escText(attrs.title || lang || 'text');
  return `<div class="codeblock"><div class="codeblock-head"><span class="lang">${label}</span>` +
    `<button class="copy" type="button">${ICON.copy}<span>Copy</span></button></div>` +
    `<pre><code>${highlight(text.replace(/\n$/, ''), lang)}</code></pre></div>\n`;
}

/* GitHub-style callouts: `> [!NOTE]` */
function blockquote({ tokens }) {
  const inner = this.parser.parse(tokens);
  // Only the quote's first paragraph can mark it as a callout.
  const at = inner.indexOf('<p>');
  const m = at >= 0 && inner.slice(at).match(/^<p>\s*\[!(\w+)\]\s*/);
  if (!m) return `<blockquote>\n${inner}</blockquote>\n`;
  const kind = m[1];
  const content = inner.slice(0, at) + '<p>' + inner.slice(at + m[0].length);
  return `<div class="note note-${kind.toLowerCase()}">${CALLOUT_ICON[kind.toUpperCase()] || ICON.note}<div>\n${content}</div></div>\n`;
}

/* A bold-only first paragraph, or a leading bold run, is the step title. */
function stepContent(parser, tokens) {
  const [first, ...rest] = tokens;
  const title = strong => `<p class="step-title">${parser.parseInline(strong.tokens)}</p>`;

  if (first?.type === 'paragraph') {
    const solid = first.tokens.filter(t => !(t.type === 'text' && !t.text.trim()));
    if (solid.length === 1 && solid[0].type === 'strong') return title(solid[0]) + '\n' + parser.parse(rest);
  }
  if (first?.type === 'text' && first.tokens?.[0]?.type === 'strong') {
    const [strong, ...tail] = first.tokens;
    return title(strong) + parser.parseInline(tail) + '\n' + parser.parse(rest);
  }
  return parser.parse(tokens);
}

function list(token) {
  if (!token.ordered) return Renderer.prototype.list.call(this, token);
  const start = token.start !== 1 ? ` start="${token.start}"` : '';
  const items = token.items.map(item => {
    const tokens = item.tokens.map(t => (t.type === 'list' && !t.ordered ? { ...t, sublist: true } : t));
    return `<li>${stepContent(this.parser, tokens)}</li>\n`;
  });
  return `<ol${start} class="steps">\n${items.join('')}</ol>\n`;
}

function table(token) {
  return Renderer.prototype.table.call(this, token).replace('<table>', '<table class="ref">');
}

function createRenderer({ allowedHtml, resolveLink }) {
  const allowedTag = new RegExp(`</?(?:${allowedHtml.join('|')})\\s*/?>|<details open>`, 'gi');

  const checkUrl = href => {
    const scheme = href.trim().match(/^([a-z][\w+.-]*):/i)?.[1].toLowerCase();
    if (scheme && !SAFE_SCHEMES.has(scheme)) throw new Error(`link scheme "${scheme}:" is not allowed`);
  };

  return new Marked({
    gfm: true,
    renderer: {
      code: codeBlock,
      blockquote,
      table,
      list(token) {
        const html = list.call(this, token);
        return token.sublist ? html.replace(/^<ul/, '<ul class="sublist"') : html;
      },
      html({ text }) {
        if (/<[a-z!/?]/i.test(text.replace(allowedTag, ''))) {
          throw new Error(`raw HTML is not allowed (only ${allowedHtml.join(', ')}): ${text.trim().slice(0, 60)}`);
        }
        return text;
      },
      link(token) {
        checkUrl(token.href);
        return Renderer.prototype.link.call(this, { ...token, href: resolveLink(token.href) });
      },
      image(token) {
        checkUrl(token.href);
        if (!/^https?:/i.test(token.href)) throw new Error(`local images are not supported yet: ${token.href}`);
        return Renderer.prototype.image.call(this, token);
      },
    },
  });
}

const slugify = s => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');

/**
 * Markdown body -> { intro, sections }. Each H2 starts a numbered section.
 * `resolveLink(href)` rewrites link targets for the page being rendered.
 */
export function renderArticle(body, options) {
  const marked = createRenderer(options);
  const tokens = marked.lexer(body);
  const render = list => marked.parser(Object.assign(list, { links: tokens.links }));

  const intro = [];
  const groups = [];
  for (const token of tokens) {
    if (token.type === 'heading' && token.depth === 2) groups.push({ heading: token, tokens: [] });
    else (groups.at(-1)?.tokens ?? intro).push(token);
  }

  const ids = new Set(PAGE_IDS);
  const sections = groups.map(({ heading, tokens: content }, i) => {
    let inner = render([heading]).trim().replace(/^<h2>|<\/h2>$/g, '');
    const attrs = inner.match(ATTR_RE);
    if (attrs) inner = inner.replace(ATTR_RE, '');
    else if (inner.includes('{#')) throw new Error(`malformed heading attributes: ## ${heading.text}`);

    const id = attrs ? attrs[1] : slugify(textOf(inner));
    if (!id || ids.has(id)) throw new Error(`section id "${id}" is empty or already used; set one with {#id}: ## ${heading.text}`);
    ids.add(id);

    const toc = textOf(attrs?.[2] || inner);
    const num = String(i + 1).padStart(2, '0');
    const html = `<section id="${esc(id)}"><div class="section-head"><span class="section-num">${num}</span>` +
      `<h2>${inner}</h2></div><div class="section-body">${render(content)}</div></section>`;
    return { id, toc, html };
  });

  return { intro: render(intro), sections };
}

/* Link targets in `](target)` and `[id]: target`, skipping inline code spans. */
function rewriteLinks(line, resolveLink) {
  return line.split(/(`+[^`]*`+)/).map((part, i) => (i % 2 ? part : part
    .replace(/(\]\()([^()\s]+)/g, (_, open, href) => open + resolveLink(href))
    .replace(/^(\s*\[[^\]]+\]:\s+)(\S+)/, (_, label, href) => label + resolveLink(href))
  )).join('');
}

/* Outside fenced code: drop heading attributes and rewrite link targets. */
function cleanBody(body, resolveLink) {
  let fence = null;
  return body.split('\n').map(line => {
    const marker = line.match(/^\s*(?:>\s*)*(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return line;
    }
    if (fence) return line;
    const bare = line.replace(/^(#{1,6} .*?)[ \t]*\{#[\w-]+(?:[ \t]+toc="[^"]*")?\}[ \t]*$/, '$1');
    return rewriteLinks(bare, resolveLink);
  }).join('\n');
}

/** Title + lede + body, for "Copy page", the .md output and llms-full.txt. */
export function toCleanMarkdown({ title, lede }, body, resolveLink = href => href) {
  const clean = cleanBody(body.replace(/\r\n/g, '\n'), resolveLink).trim();
  return [`# ${title}`, lede?.trim(), clean].filter(Boolean).join('\n\n') + '\n';
}
