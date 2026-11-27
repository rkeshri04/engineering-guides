/**
 * Parse a fenced code block's info string: `lang key="value" key=value`.
 * Attributes used: title (label), manual="reason" and check=json (testing).
 */
export function parseInfo(info = '') {
  const first = info.trim().match(/^[^\s=]+(?=\s|$)/);
  const lang = first ? first[0].toLowerCase() : '';
  const attrs = {};
  const rest = info.trim().slice(first ? first[0].length : 0);
  for (const [, key, quoted, bare] of rest.matchAll(/([\w-]+)=(?:"([^"]*)"|(\S+))/g)) {
    attrs[key] = quoted ?? bare;
  }
  return { lang, attrs };
}
