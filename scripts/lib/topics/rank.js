/* "Common and unsolved" first, favouring recent activity. */
const WEIGHTS = { engagement: 0.5, openness: 0.3, recency: 0.2 };
const HALF_LIFE_DAYS = 180;

/*
 * Views, comments and points are not comparable, so engagement is the item's
 * position among results from the same source (0 to 1).
 */
function positions(items) {
  const bySource = new Map();
  for (const item of items) {
    if (!bySource.has(item.source)) bySource.set(item.source, []);
    bySource.get(item.source).push(item.engagement);
  }
  for (const values of bySource.values()) values.sort((a, b) => a - b);
  return item => {
    const values = bySource.get(item.source);
    return values.filter(v => v <= item.engagement).length / values.length;
  };
}

/** Drop titles containing any of the phrases, ignoring case. */
export const exclude = (items, phrases = []) => {
  const lower = phrases.map(p => p.toLowerCase());
  return items.filter(item => !lower.some(p => String(item.title).toLowerCase().includes(p)));
};

/** The items with a 0-100 `score`, best first, one per link. */
export function rank(items, { now }) {
  const unique = [...new Map(items.map(item => [item.url, item])).values()];
  const position = positions(unique);
  return unique.map(item => {
    const age = Math.max(0, now - item.activity) / 86_400_000;
    const score = WEIGHTS.engagement * position(item) + WEIGHTS.openness * item.openness +
      WEIGHTS.recency * 0.5 ** (age / HALF_LIFE_DAYS);
    return { ...item, score: Math.round(score * 100) };
  }).sort((a, b) => b.score - a.score || b.engagement - a.engagement || (a.url < b.url ? -1 : 1));
}
