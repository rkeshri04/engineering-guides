/* Characters that can hide text from a human reader but not from a program. */
const FORBIDDEN = new RegExp(
  '[\\p{Cc}\\p{Cf}\\p{Co}\\p{Zl}\\p{Zp}' +      // controls, formats (zero-width, bidi, tags), private use
  '\\u034F\\u115F\\u1160\\u17B4\\u17B5\\u180B-\\u180F\\u2800\\u3164\\uFFA0' + // blank-looking letters and marks
  '\\u{E0000}-\\u{E0FFF}]',                      // tag characters and supplementary variation selectors
  'u');
const SELECTOR = /^[\u{FE00}-\u{FE0F}]$/u;

const NAMES = [
  [0x00ad, 0x00ad, 'soft hyphen'],
  [0x200b, 0x200d, 'zero-width character'],
  [0x200e, 0x200f, 'direction mark'],
  [0x202a, 0x202e, 'bidirectional control'],
  [0x2060, 0x2064, 'invisible operator'],
  [0x2066, 0x2069, 'bidirectional control'],
  [0xfe00, 0xfe0f, 'variation selector payload'],
  [0xfeff, 0xfeff, 'zero-width no-break space'],
  [0xe0000, 0xe007f, 'Unicode tag character'],
  [0xe0100, 0xe01ef, 'variation selector payload'],
];

/** "U+200B (zero-width character)": findings never print the character itself. */
export function describe(char) {
  const code = char.codePointAt(0);
  const name = NAMES.find(([from, to]) => code >= from && code <= to)?.[2] ?? 'non-printing character';
  return `U+${code.toString(16).toUpperCase().padStart(4, '0')} (${name})`;
}

/** Hidden or deceptive characters in one line of text (newline already removed). */
export function hiddenChars(line) {
  const found = [];
  let previous = '';
  for (const char of line) {
    if (char === '\t') { previous = char; continue; }
    // One selector after a symbol is ordinary emoji; after ASCII or another selector it is not.
    const selector = SELECTOR.test(char) && (previous === '' || previous.codePointAt(0) < 0x80 || SELECTOR.test(previous));
    // A lone U+FE0F after a keycap base (#, *, digits) is also ordinary emoji.
    const keycap = char === '️' && /[#*0-9]/.test(previous);
    if (FORBIDDEN.test(char) || (selector && !keycap)) found.push(char);
    previous = char;
  }
  return found;
}

const NAMED = {
  shy: '­', zwnj: '‌', zwj: '‍', lrm: '‎', rlm: '‏', ZeroWidthSpace: '​',
  NoBreak: '⁠', ApplyFunction: '⁡', InvisibleTimes: '⁢', InvisibleComma: '⁣',
};

/** Decode numeric references and the named ones that stand for invisible characters. */
export const decodeReferences = text => text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|(\w+));/g, (whole, dec, hex, name) => {
  if (name) return NAMED[name] ?? whole;
  const code = dec ? Number(dec) : parseInt(hex, 16);
  return code <= 0x10ffff ? String.fromCodePoint(code) : whole;
});
