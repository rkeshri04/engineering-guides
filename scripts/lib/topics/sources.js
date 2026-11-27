/*
 * Public search APIs. Only metadata is read (titles, counts, links), never
 * post bodies. Each source turns one search into items of the same shape:
 * { source, title, url, engagement, openness, activity (ms), detail }
 */
const HEADERS = { 'user-agent': 'topic-collector', accept: 'application/json' };
const TIMEOUT_MS = 20_000;
const PER_PAGE = 30;

const seconds = ms => Math.floor(ms / 1000);
const day = ms => new Date(ms).toISOString().slice(0, 10);

export const SOURCES = {
  stackoverflow: {
    name: 'Stack Overflow',
    pause: () => 300,
    request(tag, since, env) {
      const url = new URL('https://api.stackexchange.com/2.3/search/advanced');
      url.search = new URLSearchParams({
        site: 'stackoverflow', tagged: tag, sort: 'votes', order: 'desc',
        pagesize: PER_PAGE, fromdate: seconds(since),
        ...(env.STACKEXCHANGE_KEY && { key: env.STACKEXCHANGE_KEY }),
      });
      return { url };
    },
    items: data => data.items.map(q => ({
      title: q.title,
      url: q.link,
      engagement: Math.log10(q.view_count + 1) * 10 + Math.max(q.score, 0) * 2 + q.answer_count * 2,
      openness: q.accepted_answer_id ? 0.2 : q.is_answered ? 0.6 : 1,
      activity: q.last_activity_date * 1000,
      detail: `${q.view_count} views, ${q.score} votes, ${q.accepted_answer_id ? 'accepted answer' : `${q.answer_count} answers, none accepted`}`,
    })),
  },

  github: {
    name: 'GitHub',
    // Search allows 10 requests a minute without a token, 30 with one.
    pause: env => (env.GITHUB_TOKEN ? 2100 : 6500),
    request(query, since, env) {
      const url = new URL('https://api.github.com/search/issues');
      url.search = new URLSearchParams({
        q: `${query} is:issue is:open created:>=${day(since)}`,
        sort: 'comments', order: 'desc', per_page: PER_PAGE,
      });
      return { url, headers: env.GITHUB_TOKEN ? { authorization: `Bearer ${env.GITHUB_TOKEN}` } : {} };
    },
    items: data => data.items.map(issue => {
      const reactions = issue.reactions?.total_count ?? 0;
      return {
        title: issue.title,
        url: issue.html_url,
        engagement: issue.comments + reactions,
        openness: 1,
        activity: Date.parse(issue.updated_at),
        detail: `${issue.comments} comments, ${reactions} reactions, open`,
      };
    }),
  },

  hackernews: {
    name: 'Hacker News',
    pause: () => 200,
    request(query, since) {
      const url = new URL('https://hn.algolia.com/api/v1/search');
      url.search = new URLSearchParams({
        query, tags: 'ask_hn', restrictSearchableAttributes: 'title', typoTolerance: 'false',
        hitsPerPage: PER_PAGE, numericFilters: `created_at_i>${seconds(since)},points>5`,
      });
      return { url };
    },
    items: data => data.hits.map(hit => ({
      title: hit.title,
      url: `https://news.ycombinator.com/item?id=${encodeURIComponent(hit.objectID)}`,
      engagement: (hit.points ?? 0) + (hit.num_comments ?? 0) * 2,
      openness: 0.6, // Hacker News has no notion of an answer
      activity: hit.created_at_i * 1000,
      detail: `${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments`,
    })),
  },
};

async function getJson(fetch, { url, headers }) {
  const response = await fetch(url, { headers: { ...HEADERS, ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) {
    throw Object.assign(new Error(`HTTP ${response.status}`), { limited: [403, 429].includes(response.status) });
  }
  return response.json();
}

/**
 * Run every search in `subjects`. A failed search is recorded, not fatal; once
 * a source says we are over its limit, its remaining searches are skipped.
 * Returns { items (with .subject), failures, succeeded }.
 */
export async function collect(subjects, { since, env = {}, fetch = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), progress = () => {} }) {
  const items = [];
  const failures = [];
  let succeeded = 0;

  await Promise.all(Object.entries(SOURCES).map(async ([id, source]) => {
    const searches = subjects.flatMap(subject => (subject[id] ?? []).map(query => ({ subject: subject.id, query })));
    for (const [i, { subject, query }] of searches.entries()) {
      if (i) await sleep(source.pause(env));
      try {
        const data = await getJson(fetch, source.request(query, since, env));
        items.push(...source.items(data).map(item => ({ ...item, source: id, subject })));
        succeeded++;
        progress(`${source.name}: ${query}`);
        if (data.backoff) await sleep(data.backoff * 1000);
      } catch (error) {
        failures.push(`${source.name}, "${query}": ${error.message}`);
        if (error.limited) {
          if (i + 1 < searches.length) failures.push(`${source.name}: skipped ${searches.length - i - 1} more searches (rate limit)`);
          break;
        }
      }
    }
  }));

  return { items, failures, succeeded };
}
