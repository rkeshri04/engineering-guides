/* The agent-facing text files: https://llmstxt.org/ */

export const markdownUrl = (config, category, guide) =>
  `${config.siteUrl}${config.basePath}${category.id}/${guide.slug}.md`;

const oneLine = text => text.replace(/\s+/g, ' ').trim();

/* Drafts are never advertised, even in a build that renders them. */
const published = categories => categories
  .map(c => ({ ...c, guides: c.guides.filter(g => !g.draft) }))
  .filter(c => c.guides.length);

const header = config => [`# ${oneLine(config.title)}`, `> ${oneLine(config.description)}`];

export function llmsTxt(config, categories) {
  const sections = published(categories).map(category => {
    const items = category.guides.map(guide => {
      const title = oneLine(guide.title).replace(/[[\]]/g, '\\$&');
      return `- [${title}](${markdownUrl(config, category, guide)}): ${oneLine(guide.summary)}`;
    });
    return [`## ${oneLine(category.name)}`, items.join('\n')].join('\n\n');
  });
  return [...header(config), ...sections].join('\n\n') + '\n';
}

/** Every published guide's Markdown, each preceded by a rule and its source URL. */
export function llmsFullTxt(config, categories, markdownOf) {
  const guides = published(categories).flatMap(category => category.guides.map(guide =>
    `---\n\nSource: ${markdownUrl(config, category, guide)}\nCategory: ${oneLine(category.name)}\n\n` +
    markdownOf.get(guide.slug).trim()));
  return [...header(config), ...guides].join('\n\n') + '\n';
}
