/* A guide's code blocks and how each is verified. Shared by build, check and test. */
import { Marked } from 'marked';
import { parseInfo } from './fence.js';
import { splitFrontMatter } from './front-matter.js';

export const RUNNABLE = new Set(['bash', 'sh']);

export function codeBlocks(markdown) {
  const marked = new Marked({ gfm: true });
  const blocks = [];
  let section = '(before the first section)';
  marked.walkTokens(marked.lexer(splitFrontMatter(markdown.replace(/\r\n/g, '\n')).body), token => {
    if (token.type === 'heading' && token.depth === 2) section = token.text.replace(/\s*\{#.*\}\s*$/, '');
    if (token.type !== 'code') return;
    const { lang, attrs } = parseInfo(token.lang);
    blocks.push({
      number: blocks.length + 1,
      section,
      text: token.text,
      run: RUNNABLE.has(lang) && !attrs.manual && !attrs.check,
      json: attrs.check === 'json',
      manual: attrs.manual,
    });
  });
  return blocks;
}
