export const MAX_AGE_DAYS = 90;

export default {
  id: 'STALE_VERIFICATION',
  severity: 'warning',
  appliesTo: file => file.kind === 'guide' && file.data && file.data.status !== 'draft',
  check(file, { now }) {
    const { verified } = file.data;
    if (!verified) return [{ line: 1, message: 'no "verified" date' }];
    const days = Math.floor((now - new Date(`${verified}T00:00:00Z`)) / 86_400_000);
    if (!(days > MAX_AGE_DAYS)) return [];
    const line = file.lines.findIndex(text => text.startsWith('verified:')) + 1;
    return [{ line, message: `verified ${days} days ago (more than ${MAX_AGE_DAYS})` }];
  },
};
