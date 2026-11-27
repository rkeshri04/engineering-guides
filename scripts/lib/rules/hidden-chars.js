import { describe, decodeReferences, hiddenChars } from '../unicode.js';

/* Values only visible after parsing, e.g. "​" written as a YAML or JSON escape. */
const strings = value => typeof value === 'string' ? [value]
  : value && typeof value === 'object' ? Object.entries(value).flat().flatMap(strings) : [];

export default {
  id: 'INVISIBLE_CHAR',
  severity: 'error',
  check(file) {
    const found = [];
    file.lines.forEach((line, i) => {
      for (const char of new Set(hiddenChars(line))) found.push({ line: i + 1, message: `hidden character ${describe(char)}` });
      const decoded = decodeReferences(line);
      if (decoded !== line) {
        const before = new Set(hiddenChars(line));
        for (const char of new Set(hiddenChars(decoded))) {
          if (!before.has(char)) found.push({ line: i + 1, message: `character reference for ${describe(char)}` });
        }
      }
    });
    if (!found.length) {
      for (const text of strings(file.data)) {
        for (const char of new Set(text.split('\n').flatMap(hiddenChars))) {
          found.push({ line: 1, message: `escaped value contains ${describe(char)}` });
        }
      }
    }
    return found;
  },
};
