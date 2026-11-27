import { readFile } from 'node:fs/promises';
import path from 'node:path';

const withSlashes = p => `/${p}/`.replace(/\/{2,}/g, '/');

/** site.config.json, with BASE_PATH and SITE_URL environment overrides. */
export async function loadConfig(root, env = process.env) {
  const config = JSON.parse(await readFile(path.join(root, 'site.config.json'), 'utf8'));
  return {
    ...config,
    basePath: withSlashes(env.BASE_PATH || config.basePath || '/'),
    siteUrl: (env.SITE_URL || config.siteUrl).replace(/\/+$/, ''),
  };
}
