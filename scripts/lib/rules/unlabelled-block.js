import { RUNNABLE } from '../blocks.js';
import { parseInfo } from '../fence.js';


/* In a guide with a test file, every code block says how it is verified. */
export default {
  id: 'UNLABELLED_BLOCK',
  severity: 'error',
  appliesTo: file => file.kind === 'guide',
  check(file) {
    return file.tokens.filter(({ token }) => token.type === 'code').flatMap(({ token, line }) => {
      const { lang, attrs } = parseInfo(token.lang);
      if ('manual' in attrs && !attrs.manual.trim()) return [{ line, message: 'manual="" needs a reason' }];
      if ('check' in attrs && attrs.check !== 'json') return [{ line, message: 'the only supported check is check=json' }];
      if (!file.hasTest || RUNNABLE.has(lang) || attrs.manual || attrs.check) return [];
      return [{ line, message: 'this guide has a test: label the block manual="reason" or check=json, or make it bash/sh' }];
    });
  },
};
