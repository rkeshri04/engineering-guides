/* Anywhere in a published file, code blocks included. */
export default {
  id: 'HTML_COMMENT',
  severity: 'error',
  check: file => file.lines.flatMap((line, i) =>
    line.includes('<!--') || (line.includes('-->') && /^\s*-->/.test(line))
      ? [{ line: i + 1, message: 'HTML comments are not allowed' }] : []),
};
