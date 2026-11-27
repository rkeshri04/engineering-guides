import assert from 'node:assert/strict';
import { test } from 'node:test';
import { exclude, rank } from '../scripts/lib/topics/rank.js';
import { cleanTitle, report, safeUrl } from '../scripts/lib/topics/report.js';
import { collect } from '../scripts/lib/topics/sources.js';

const NOW = Date.parse('2026-12-01T00:00:00Z');
const DAY = 86_400_000;
const item = (over = {}) => ({
  source: 'stackoverflow', subject: 'git', title: 'A problem', url: 'https://stackoverflow.com/q/1',
  engagement: 10, openness: 1, activity: NOW, detail: 'details', ...over,
});
const ok = data => ({ ok: true, status: 200, json: async () => data });
const noSleep = async () => {};

test('common, unsolved and recent rank above their opposites, once per link', () => {
  const url = n => `https://stackoverflow.com/q/${n}`;
  const ranked = rank([
    item({ url: url('solved'), openness: 0.2 }),
    item({ url: url('old'), activity: NOW - 700 * DAY }),
    item({ url: url('best') }),
    item({ url: url('quiet'), engagement: 1 }),
    item({ url: url('best') }),
  ], { now: NOW });
  assert.equal(ranked.length, 4);
  assert.equal(ranked[0].url, url('best'));
  assert.equal(ranked[0].score, 100);
});

test('excluded phrases are matched ignoring case', () => {
  const items = [item({ title: '[FEATURE] dark mode' }), item({ title: 'Push fails' })];
  assert.deepEqual(exclude(items, ['[feature']).map(i => i.title), ['Push fails']);
});

test('titles from strangers are made inert', () => {
  assert.equal(cleanTitle('a​b‮c &amp; d\ne `rm`'), "abc & d e 'rm'");
  assert.equal(cleanTitle('x&#8203;y &#x202E;z'), 'xy z');
  assert.ok(cleanTitle('long '.repeat(100)).length <= 160);
});

test('only links to the three sources are kept', () => {
  assert.equal(safeUrl('https://github.com/a/b/issues/1'), 'https://github.com/a/b/issues/1');
  assert.equal(safeUrl('http://github.com/a'), null);
  assert.equal(safeUrl('https://github.com.example.net/a'), null);
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('https://github.com/a(1)'), 'https://github.com/a%281%29');
});

test('the report lists each source and leaves out unsafe links', () => {
  const ranked = rank([item({ title: 'Kept' }), item({ title: 'Dropped', url: 'https://example.net/x' })], { now: NOW });
  const text = report([{ id: 'git', name: 'Git' }], ranked, { date: '2026-12-01', days: 365, limit: 5, failures: [] });
  assert.match(text, /### Stack Overflow\n\n1\. \*\*\d+\*\* `Kept`/);
  assert.match(text, /### Hacker News\n\nNothing found\./);
  assert.doesNotMatch(text, /Dropped/);
});

test('each source is parsed, and a rate limit stops only that source', async () => {
  const calls = [];
  const fetch = async url => {
    calls.push(url.hostname);
    if (url.hostname === 'api.github.com') return { ok: false, status: 403 };
    if (url.hostname === 'hn.algolia.com') {
      return ok({ hits: [{ title: 'Ask', objectID: '7', points: 10, num_comments: 4, created_at_i: 1_700_000_000 }] });
    }
    return ok({ items: [{ title: 'Q', link: 'https://stackoverflow.com/q/2', view_count: 99, score: 1,
      answer_count: 0, is_answered: false, last_activity_date: 1_700_000_000 }] });
  };
  const subjects = [{ id: 'git', stackoverflow: ['git'], github: ['repo:a/b', 'repo:c/d'], hackernews: ['git'] }];
  const { items, failures, succeeded } = await collect(subjects, { since: 0, fetch, sleep: noSleep });
  assert.equal(succeeded, 2);
  assert.equal(calls.filter(h => h === 'api.github.com').length, 1);
  assert.match(failures.join('\n'), /HTTP 403[\s\S]*skipped 1 more/);
  assert.deepEqual(items.map(i => [i.source, i.openness, i.url]).sort(), [
    ['hackernews', 0.6, 'https://news.ycombinator.com/item?id=7'],
    ['stackoverflow', 1, 'https://stackoverflow.com/q/2'],
  ]);
});
