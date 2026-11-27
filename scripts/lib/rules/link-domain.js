const host = url => {
  try {
    const { protocol, hostname } = new URL(url);
    return /^https?:$/.test(protocol) ? hostname.replace(/^www\./, '') : null;
  } catch {
    return null; // relative link
  }
};

export default {
  id: 'LINK_DOMAIN',
  severity: 'warning',
  appliesTo: file => file.kind === 'guide',
  check(file, { config }) {
    const allowed = new Set([...config.linkAllowlist, host(config.siteUrl)]);
    return file.tokens
      .filter(({ token }) => ['link', 'image', 'def'].includes(token.type))
      .map(({ token, line }) => ({ line, domain: host(token.href) }))
      .filter(({ domain }) => domain && !allowed.has(domain))
      .map(({ line, domain }) => ({ line, message: `link to ${domain}, which is not in linkAllowlist` }));
  },
};
