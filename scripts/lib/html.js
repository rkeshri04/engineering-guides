export const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escaping for element text, where quotes can stay literal. */
export const escText = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };

/** Plain text of a rendered inline HTML fragment (like DOM textContent). */
export const textOf = html => html
  .replace(/<[^>]*>/g, '')
  .replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ENTITIES[name]);

/**
 * Replace `{{name}}` placeholders in one pass, so inserted content is never
 * re-expanded. Values are inserted as-is: escape them before passing them in.
 */
export function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    if (!(name in values)) throw new Error(`template: no value for {{${name}}}`);
    return values[name];
  });
}
