import { escText } from './html.js';

/* Deliberately minimal: strings, JSON keys, shell comments. */
const SHELL = new Set(['bash', 'sh', 'shell', 'zsh', 'console']);

export function highlight(code, lang) {
  const re = /("(?:\\.|[^"\\])*"|'[^']*')(\s*:)?|(^|[ \t])(#[^\n]*)/gm;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += escText(code.slice(last, m.index));
    if (m[1]) {
      const isKey = lang === 'json' && m[2];
      out += `<span class="${isKey ? 'tok-k' : 'tok-s'}">${escText(m[1])}</span>${m[2] ? escText(m[2]) : ''}`;
    } else if (SHELL.has(lang)) {
      out += escText(m[3]) + `<span class="tok-c">${escText(m[4])}</span>`;
    } else {
      out += escText(m[0]);
    }
    last = re.lastIndex;
  }
  return out + escText(code.slice(last));
}
