import { hasDisallowedHtml } from '../markdown.js';

export default {
  id: 'RAW_HTML',
  severity: 'error',
  appliesTo: file => file.kind === 'guide',
  check(file, { config }) {
    return file.tokens
      .filter(({ token }) => token.type === 'html' && !token.text.trimStart().startsWith('<!--'))
      .filter(({ token }) => hasDisallowedHtml(token.text, config.allowedHtml))
      .map(({ line }) => ({ line, message: `raw HTML is not allowed (only ${config.allowedHtml.join(', ')})` }));
  },
};
