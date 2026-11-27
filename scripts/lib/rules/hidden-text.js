/*
 * Markdown that readers of the page never see but readers of the .md file do:
 * unused or titled link definitions, and extra words on a code fence.
 */
const DEFINITION = /^ {0,3}(?:>\s*)*\[((?:\\.|[^\]\\])+)\]:[ \t]*(\S+)([ \t]+\S.*)?$/;
const normalise = label => label.toLowerCase().replace(/\s+/g, ' ').trim();

function usedLabels(tokens) {
  const used = new Set();
  for (const { token } of tokens) {
    if (token.type !== 'link' && token.type !== 'image') continue;
    const reference = token.raw.match(/^!?\[((?:\\.|[^\]\\])*)\](?:\[((?:\\.|[^\]\\])*)\])?$/);
    if (reference) used.add(normalise(reference[2] || reference[1]));
  }
  return used;
}

function definitions(file) {
  const used = usedLabels(file.tokens);
  const seen = new Set();
  const found = [];
  file.prose.forEach(({ text, line }) => {
    const m = text.match(DEFINITION);
    if (!m) return;
    const label = normalise(m[1]);
    if (!used.has(label)) found.push({ line, message: 'unused link definition: it is invisible on the page' });
    else if (seen.has(label)) found.push({ line, message: 'duplicate link definition: it is ignored and invisible' });
    else if (m[3]) found.push({ line, message: 'link definitions may not carry extra text' });
    seen.add(label);
  });
  return found;
}

const ATTRIBUTE = /\s+(title|manual|check)="[^"]*"|\s+check=json(?=\s|$)/g;

function fences(file) {
  return file.tokens
    .filter(({ token }) => token.type === 'code' && token.lang)
    .filter(({ token }) => {
      const info = ` ${token.lang.trim()}`.replace(ATTRIBUTE, '').trim();
      return info !== '' && !/^[\w+#.-]+$/.test(info);
    })
    .map(({ line }) => ({ line, message: 'unexpected text after the code fence language (allowed: title="", manual="", check=json)' }));
}

export default {
  id: 'HIDDEN_TEXT',
  severity: 'error',
  appliesTo: file => file.kind === 'guide',
  check: file => [...definitions(file), ...fences(file)],
};
