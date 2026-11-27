import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Marked } from 'marked';
import { loadConfig } from './config.js';
import { loadContent } from './content.js';
import { readGuide, splitFrontMatter } from './front-matter.js';
import { renderSite } from './site.js';
import { decodeReferences, describe, hiddenChars } from './unicode.js';
import hiddenCharsRule from './rules/hidden-chars.js';
import hiddenText from './rules/hidden-text.js';
import htmlComment from './rules/html-comment.js';
import internalRef from './rules/internal-ref.js';
import linkDomain from './rules/link-domain.js';
import rawHtml from './rules/raw-html.js';
import riskyCommand from './rules/risky-command.js';
import staleVerification from './rules/stale-verification.js';
import unlabelledBlock from './rules/unlabelled-block.js';

const RULES = [hiddenCharsRule, htmlComment, rawHtml, hiddenText, unlabelledBlock, internalRef,
  linkDomain, riskyCommand, staleVerification];

/* Folders whose committed files are public. internal/ is never checked here. */
const PUBLIC_DIRS = ['docs', 'drafts'];

async function listFiles(root, dir) {
  try {
    const entries = await readdir(path.join(root, dir), { recursive: true, withFileTypes: true });
    return entries.filter(e => e.isFile() && e.name !== '.DS_Store')
      .map(e => path.relative(root, path.join(e.parentPath, e.name)).split(path.sep).join('/'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/* Every token with the file line it starts on. */
function locate(marked, text) {
  const { body } = splitFrontMatter(text);
  const lines = text.split('\n');
  let cursor = lines.length - body.split('\n').length;
  const found = [];
  marked.walkTokens(marked.lexer(body), token => {
    const first = token.raw?.split('\n').find(l => l.trim())?.trim();
    let line = cursor;
    if (first) {
      const at = lines.findIndex((l, i) => i >= cursor && l.includes(first));
      if (at >= 0) { line = at; cursor = at; }
    }
    found.push({ token, line: line + 1 });
  });
  return found;
}

/* Lines outside fenced code blocks. */
function proseLines(lines) {
  let fence = null;
  return lines.flatMap((text, i) => {
    const marker = text.match(/^\s*(?:>\s*)*(`{3,}|~{3,})/)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return [];
    }
    return fence ? [] : [{ text, line: i + 1 }];
  });
}

async function describeFile(root, name, all, marked) {
  const raw = await readFile(path.join(root, name), 'utf8');
  const text = raw.replace(/\r\n/g, '\n');
  const inContent = PUBLIC_DIRS.includes(name.split('/')[0]);
  const kind = inContent && name.endsWith('.md') ? 'guide' : 'text';
  const file = { path: name, kind, lines: text.split('\n') };
  if (kind === 'guide') {
    file.data = readGuide(text).data;
    file.tokens = locate(marked, text);
    file.prose = proseLines(file.lines);
    file.hasTest = all.includes(name.replace(/\.md$/, '.test.sh'));
  } else if (name.endsWith('.json')) {
    try { file.data = JSON.parse(text); } catch { /* reported by the loader */ }
  }
  return file;
}

/* The last line of defence: what is actually about to be published. */
async function checkBuild(root) {
  let files;
  try {
    ({ files } = await renderSite(root));
  } catch (error) {
    return [{ file: 'dist', line: 1, rule: 'BUILD', severity: 'error', message: error.message.replace(/\n/g, '; ') }];
  }
  const found = [];
  for (const [name, content] of files) {
    if (name.startsWith('assets/')) continue;
    const text = name.endsWith('.html') ? decodeReferences(content) : content;
    text.split('\n').forEach((line, i) => {
      for (const char of new Set(hiddenChars(line))) {
        found.push({ file: `dist/${name}`, line: i + 1, rule: 'INVISIBLE_CHAR', severity: 'error', message: `output contains ${describe(char)}` });
      }
    });
  }
  return found;
}

/** All findings as { file, line, rule, severity, message }, sorted by file and line. */
export async function runChecks(root, { now = new Date() } = {}) {
  const config = await loadConfig(root);
  const context = { config, now };
  const marked = new Marked({ gfm: true });
  const findings = [];

  try {
    await loadContent(root, { drafts: true });
  } catch (error) {
    if (!error.problems) throw error;
    findings.push(...error.problems.map(p => ({ ...p, severity: 'error' })));
  }

  const content = (await Promise.all(PUBLIC_DIRS.map(dir => listFiles(root, dir)))).flat();
  const other = [...await listFiles(root, 'templates'), 'site.config.json'];
  for (const name of [...content, ...other]) {
    const file = await describeFile(root, name, content, marked);
    // Templates and config are ours: only hidden characters matter there.
    const rules = other.includes(name) ? [hiddenCharsRule] : RULES;
    for (const rule of rules) {
      if (rule.appliesTo && !rule.appliesTo(file)) continue;
      for (const { line, message } of rule.check(file, context)) {
        findings.push({ file: name, line, rule: rule.id, severity: rule.severity, message });
      }
    }
  }

  // A broken source would only repeat itself as a build failure.
  if (!findings.some(f => f.severity === 'error')) findings.push(...await checkBuild(root));

  const unique = [...new Map(findings.map(f => [`${f.file}:${f.line} ${f.rule} ${f.message}`, f])).values()];
  return unique.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : a.line - b.line));
}
