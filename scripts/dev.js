/* Build, watch the sources, rebuild on change and serve the output locally. */
import { spawn } from 'node:child_process';
import { watch } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadConfig } from './lib/config.js';
import { esc } from './lib/html.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
  '.json': 'application/json',
};

const { values } = parseArgs({
  options: {
    drafts: { type: 'boolean' },
    'include-internal': { type: 'boolean' },
    port: { type: 'string', default: process.env.PORT || '4000' },
  },
});
const flags = ['drafts', 'include-internal'].filter(f => values[f]).map(f => `--${f}`);
const outDir = path.join(ROOT, values['include-internal'] ? 'dist-internal' : 'dist');

let basePath = '/';
let buildError = null;

/* Each build is a new process, so edits under scripts/ take effect too. */
function runBuild() {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts/build.js'), ...flags], { cwd: ROOT });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('close', code => resolve({ ok: code === 0, output: output.trim() }));
  });
}

let building = false;
let queued = false;

async function rebuild() {
  if (building) { queued = true; return; }
  building = true;
  do {
    queued = false;
    const started = performance.now();
    const { ok, output } = await runBuild();
    buildError = ok ? null : output;
    console.log(`${output}  (${Math.round(performance.now() - started)} ms)`);
    try {
      ({ basePath } = await loadConfig(ROOT));
    } catch (error) {
      buildError = `site.config.json: ${error.message}`;
    }
  } while (queued);
  building = false;
}

let timer;
const changed = () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 80);
};

function watchSources() {
  const dirs = ['docs', 'templates', 'assets', 'scripts'];
  if (values.drafts) dirs.push('drafts');
  if (values['include-internal']) dirs.push('internal');
  for (const dir of dirs) {
    try {
      watch(path.join(ROOT, dir), { recursive: true }, changed);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      console.log(`Not watching ${dir}/ (it does not exist; restart after creating it)`);
    }
  }
  // Watch the folder, not the file: editors often replace a file when saving.
  watch(ROOT, (_, name) => { if (name === 'site.config.json') changed(); });
}

function send(res, status, type, body) {
  res.writeHead(status, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

async function handle(req, res) {
  if (buildError) {
    return send(res, 500, 'text/html', `<!DOCTYPE html><title>Build failed</title><h1>Build failed</h1><pre>${esc(buildError)}</pre>`);
  }
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(basePath)) {
    if (url.pathname === '/') return redirect(res, basePath);
    return send(res, 404, 'text/plain', `Not found. The site is served under ${basePath}`);
  }
  try {
    let file = path.join(outDir, decodeURIComponent(url.pathname.slice(basePath.length)));
    if (file !== outDir && !file.startsWith(outDir + path.sep)) throw new Error('outside the site');
    if ((await stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) return redirect(res, `${url.pathname}/${url.search}`);
      file = path.join(file, 'index.html');
    }
    send(res, 200, TYPES[path.extname(file)] || 'application/octet-stream', await readFile(file));
  } catch {
    const page = await readFile(path.join(outDir, '404.html')).catch(() => 'Not found');
    send(res, 404, 'text/html', page);
  }
}

await rebuild();
watchSources();

const server = http.createServer(handle);
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${values.port} is in use. Try: npm run dev -- --port ${Number(values.port) + 1}`
    : error.message);
  process.exit(1);
});
// Loopback only: an internal build must not be reachable from the network.
server.listen(Number(values.port), '127.0.0.1', () => {
  console.log(`Serving ${path.relative(ROOT, outDir)}/ at http://localhost:${values.port}${basePath}`);
  console.log('Reload the page after a rebuild. Changes to scripts/dev.js need a restart.');
});
