import { INTERNAL_PATH } from '../leaks.js';

export default {
  id: 'INTERNAL_REF',
  severity: 'error',
  check: file => file.lines.flatMap((line, i) =>
    INTERNAL_PATH.test(line) ? [{ line: i + 1, message: 'public content refers to an internal/ path' }] : []),
};
