import { parse } from 'yaml';

export const TYPES = ['Reference', 'How-to', 'Recovery'];
const STATUSES = ['published', 'draft'];

export function splitFrontMatter(source) {
  const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!m) return { yaml: null, body: source };
  return { yaml: m[1], body: source.slice(m[0].length) };
}

const isText = v => typeof v === 'string' && v.trim() !== '';
const isOneLine = v => isText(v) && !v.trim().includes('\n');
const isScalar = v => ['string', 'number', 'boolean'].includes(typeof v);
const isMap = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isDate = v => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const date = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(v);
};

const SCHEMA = {
  title: { required: true, test: isOneLine, expected: 'a one-line string' },
  summary: { required: true, test: isOneLine, expected: 'a one-line string' },
  type: { required: true, test: v => TYPES.includes(v), expected: `one of ${TYPES.join(', ')}` },
  lede: { test: isText, expected: 'a string' },
  eyebrow: { test: isOneLine, expected: 'a one-line string' },
  meta: { test: v => isMap(v) && Object.values(v).every(isScalar), expected: 'a map of plain values' },
  status: { test: v => STATUSES.includes(v), expected: `one of ${STATUSES.join(', ')}` },
  order: { test: Number.isFinite, expected: 'a number' },
  verified: { test: isDate, expected: 'a date as YYYY-MM-DD' },
  tested_with: { test: isOneLine, expected: 'a one-line string' },
};

/** Returns { data, body, problems }. Never throws on bad input. */
export function readGuide(source) {
  const { yaml, body } = splitFrontMatter(source);
  if (yaml === null) return { data: {}, body, problems: ['missing front matter'] };
  let data;
  try {
    data = parse(yaml);
  } catch (error) {
    return { data: {}, body, problems: [`front matter is not valid YAML: ${error.message.split('\n')[0]}`] };
  }
  if (!isMap(data)) return { data: {}, body, problems: ['front matter must be a map of keys'] };

  const problems = [];
  for (const key of Object.keys(data)) {
    if (!Object.hasOwn(SCHEMA, key)) problems.push(`unknown front matter key "${key}"`);
  }
  for (const [key, rule] of Object.entries(SCHEMA)) {
    if (data[key] === undefined) {
      if (rule.required) problems.push(`"${key}" is required`);
    } else if (!rule.test(data[key])) {
      problems.push(`"${key}" must be ${rule.expected}`);
    }
  }
  return { data, body, problems };
}
