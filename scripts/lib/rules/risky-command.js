const SHELLS = String.raw`(?:sudo\s+(?:-\S+\s+)*)?(?:\S*/)?(?:ba|z|da|k)?sh\b`;
const SECRETS = String.raw`(?:~|\$HOME|\$\{HOME\}|/(?:home|Users)/[^/\s]+)/(?:\.ssh\b|\.aws/credentials|\.netrc|\.npmrc|\.git-credentials|\.docker/config\.json|\.kube/config)`;

const PATTERNS = [
  [new RegExp(String.raw`\b(?:curl|wget)\b[^\n;&]*\|\s*${SHELLS}`), 'pipes a download into a shell'],
  [new RegExp(String.raw`${SHELLS}\s+(?:-c\s+)?["']?(?:<\(|\$\()\s*(?:curl|wget)\b`), 'runs a download in a shell'],
  [new RegExp(String.raw`\bbase64\b[^\n;&]*\s(?:-d|-D|--decode)\b[^\n;&]*\|\s*${SHELLS}`), 'runs base64-decoded text in a shell'],
  [/(?:^|[;&|(]\s*)eval\s/, 'uses eval'],
  [/\brm\s+(?=(?:-\S+\s+)*-[a-zA-Z]*[rR])(?=(?:-\S+\s+)*-[a-zA-Z]*f)(?:-\S+\s+)+["']?(?:\/|~|\$HOME|\$\{HOME\}|\.\.?|\*|\$\w+)\/?\*?["']?(?:\s|$|;|&)/, 'removes a broad target with rm -rf'],
  [new RegExp(String.raw`(?:>>?\s*|\btee\s+(?:-a\s+)?|\b(?:cp|mv|ln|install)\b[^\n;&|]*\s)["']?${SECRETS}[^\s;&|]*["']?\s*(?:$|[;&|])`), 'writes to SSH or credential files'],
];

/* Join `\` continuations so a command split over lines is still one command. */
function commands(code) {
  const result = [];
  let pending = null;
  code.split('\n').forEach((line, offset) => {
    const joined = pending ? { offset: pending.offset, text: pending.text + line.trimStart() } : { offset, text: line };
    if (/(?:\\|\|)\s*$/.test(joined.text)) pending = { offset: joined.offset, text: joined.text.replace(/\\\s*$/, '').trimEnd() + ' ' };
    else { result.push(joined); pending = null; }
  });
  if (pending) result.push(pending);
  return result;
}

export default {
  id: 'RISKY_COMMAND',
  severity: 'warning',
  appliesTo: file => file.kind === 'guide',
  check(file) {
    return file.tokens.filter(({ token }) => token.type === 'code').flatMap(({ token, line }) =>
      commands(token.text).flatMap(({ text, offset }) => PATTERNS
        .filter(([pattern]) => pattern.test(text))
        .map(([, message]) => ({ line: line + (token.codeBlockStyle === 'indented' ? 0 : 1) + offset, message: `${message}` }))));
  },
};
