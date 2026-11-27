import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import handler from '../seekly-open.js';

const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const SEEKLY_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const NAVIGATE = { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' };
const COMPAT = readFileSync(new URL('../seekly-open.compat.js', import.meta.url), 'utf8');

// Runs the script like Egern does and returns what it answered (undefined = passed through).
async function runEgern(url, { headers = NAVIGATE, method = 'GET', env, plainHeaders = false } = {}) {
  let response;
  const ctx = {
    request: { url, method, headers: plainHeaders ? headers : new Headers(headers) },
    env,
    respond(value) {
      response = value;
      return value;
    },
  };
  await handler(ctx);
  return response;
}

// Runs seekly-open.compat.js like Surge / Loon / Stash / Shadowrocket do: a
// classic script with $request (plain-object headers), $argument and $done.
// `argument` overrides the $argument built from env (to test each app's shape).
function runCompat(url, { headers = NAVIGATE, method = 'GET', env, argument } = {}) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('$done was not called')), 1000);
    const sandbox = {
      $request: { url, method, headers: { ...headers } },
      $done(value) {
        clearTimeout(timer);
        if (!value || typeof value !== 'object') return reject(new Error(`$done(${value}) would drop the request`));
        resolve(value.response);
      },
      console,
    };
    if (argument !== undefined) sandbox.$argument = argument;
    else if (env) sandbox.$argument = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('&');
    vm.runInNewContext(COMPAT, sandbox, { filename: 'seekly-open.compat.js' });
  });
}

for (const [label, run] of [['Egern', runEgern], ['compat', runCompat]]) {
  test(`${label}: redirects a browser navigation to seekly://post/<id> by default`, async () => {
    const response = await run('https://www.nodeseek.com/post-1038101-1');
    assert.equal(response.status, 302);
    assert.equal(response.headers.Location, 'seekly://post/1038101');
    assert.equal(response.headers['Cache-Control'], 'no-store');
  });

  test(`${label}: accepts the bare domain, a trailing slash, a query and a hash`, async () => {
    for (const url of [
      'https://nodeseek.com/post-42',
      'https://www.nodeseek.com/post-42-3/',
      'https://www.nodeseek.com/post-42-3?from=tg',
      'http://www.nodeseek.com/post-42#reply',
    ]) {
      assert.equal((await run(url))?.headers.Location, 'seekly://post/42', url);
    }
  });

  test(`${label}: leaves the Seekly app, API calls, iframes and prefetches alone`, async () => {
    const url = 'https://www.nodeseek.com/post-1-1';
    assert.equal(await run(url, { headers: { ...NAVIGATE, 'User-Agent': SEEKLY_UA } }), undefined);
    assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors' } }), undefined);
    assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Mode': 'navigate' } }), undefined);
    assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Mode': 'no-cors' } }), undefined);
    assert.equal(await run(url, { headers: { 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' } }), undefined);
    assert.equal(await run(url, { method: 'POST' }), undefined);
  });

  test(`${label}: falls back to Accept: text/html without Fetch Metadata`, async () => {
    const url = 'https://www.nodeseek.com/post-7';
    assert.equal((await run(url, { headers: { 'User-Agent': SAFARI_UA, Accept: 'text/html,*/*' } }))?.status, 302);
    assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, Accept: 'application/json' } }), undefined);
  });

  test(`${label}: ?seekly=0 keeps the post in the browser`, async () => {
    for (const url of [
      'https://www.nodeseek.com/post-9-1?seekly=0',
      'https://www.nodeseek.com/post-9-1?a=1&seekly=0',
      'https://www.nodeseek.com/post-9-1?seekly=0#reply',
    ]) {
      assert.equal(await run(url), undefined, url);
    }
    assert.equal((await run('https://www.nodeseek.com/post-9-1?seekly=01'))?.status, 302);
  });

  test(`${label}: ignores non-post pages`, async () => {
    for (const url of ['https://www.nodeseek.com/', 'https://www.nodeseek.com/space/1', 'https://www.nodeseek.com/post-abc']) {
      assert.equal(await run(url), undefined, url);
    }
  });

  test(`${label}: MODE=page returns a landing page with both buttons and escaped links`, async () => {
    const response = await run('https://www.nodeseek.com/post-5-2?q="><script>#top', { env: { MODE: 'PAGE' } });
    assert.equal(response.status, 200);
    assert.match(response.headers['Content-Type'], /^text\/html/);
    assert.match(response.body, /href="seekly:\/\/post\/5"/);
    assert.match(response.body, /href="https:\/\/www\.nodeseek\.com\/post-5-2\?q=&quot;&gt;&lt;script&gt;&amp;seekly=0#top"/);
    assert.doesNotMatch(response.body, /"><script>/);
    assert.match(response.body, /location\.href = "seekly:\/\/post\/5"/);
  });

  test(`${label}: the landing page hints at installing Seekly only if it does not open`, async () => {
    const { body } = await run('https://www.nodeseek.com/post-5', { env: { MODE: 'page' } });
    assert.match(body, /<p class="hint" hidden>[^<]*<a href="https:\/\/github\.com\/maow318\/seekly-open\/releases">/);
    assert.match(body, /setTimeout\(function \(\) \{ if \(!left\) hint\.hidden = false; \}, 2500\)/);
    assert.match(body, /addEventListener\('pagehide', away\)/);
  });

  test(`${label}: an unknown MODE falls back to the redirect`, async () => {
    assert.equal((await run('https://www.nodeseek.com/post-3', { env: { MODE: 'nope' } }))?.status, 302);
  });

  test(`${label}: reads plain-object headers case-insensitively`, async () => {
    const headers = { 'user-agent': SAFARI_UA, 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' };
    assert.equal((await run('https://www.nodeseek.com/post-11', { headers, plainHeaders: true }))?.status, 302);
  });

  test(`${label}: a page load relayed by the service worker gets the landing page, even in redirect mode`, async () => {
    const url = 'https://www.nodeseek.com/post-1041825-2';
    for (const headers of [
      // fetch(event.request): destination stays document, mode is no longer navigate
      { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'same-origin', 'Sec-Fetch-Site': 'same-origin' },
      { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'cors' },
      // new Request(url, { headers }) keeps the HTML Accept header
      { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
    ]) {
      const response = await run(url, { headers });
      assert.equal(response?.status, 200, JSON.stringify(headers));
      assert.match(response.body, /location\.href = "seekly:\/\/post\/1041825"/);
    }
  });

  test(`${label}: script fetches and prefetches of a post are not redirected`, async () => {
    const url = 'https://www.nodeseek.com/post-1041825-2';
    assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', Accept: '*/*' } }), undefined);
    for (const purpose of [
      { 'Sec-Purpose': 'prefetch' },
      { 'Sec-Purpose': 'prefetch;prerender' },
      { Purpose: 'prefetch' },
      { 'X-Purpose': 'preview' },
      { 'X-Moz': 'prefetch' },
    ]) {
      assert.equal(await run(url, { headers: { ...NAVIGATE, ...purpose } }), undefined, JSON.stringify(purpose));
    }
    assert.equal(await run(url, { headers: { ...NAVIGATE, 'User-Agent': SEEKLY_UA, 'Sec-Fetch-Mode': 'same-origin' } }), undefined);
  });
}

test('compat: reads MODE from every $argument shape', async () => {
  const url = 'https://www.nodeseek.com/post-5';
  for (const argument of ['MODE=page', 'MODE=page&x=1', ' MODE = page ', 'page', { MODE: 'page' }, ['page'], '{"MODE":"page"}']) {
    assert.equal((await runCompat(url, { argument }))?.status, 200, JSON.stringify(argument));
  }
  for (const argument of ['MODE={{{MODE}}}', 'MODE={MODE}', '', 'MODE=redirect', { MODE: 'redirect' }, [], 'MODE=%E0%A4%A']) {
    assert.equal((await runCompat(url, { argument }))?.status, 302, JSON.stringify(argument));
  }
  assert.equal((await runCompat(url))?.status, 302, 'no $argument');
});

test('compat: a request without a method is treated as GET', async () => {
  assert.equal((await runCompat('https://www.nodeseek.com/post-5', { method: null }))?.status, 302);
});

test('build: runs from a checkout whose path has spaces or non-ASCII characters', () => {
  const dir = mkdtempSync(join(tmpdir(), '代码 seekly-'));
  try {
    mkdirSync(join(dir, 'scripts'));
    copyFileSync(fileURLToPath(new URL('../scripts/build-compat.mjs', import.meta.url)), join(dir, 'scripts/build-compat.mjs'));
    copyFileSync(fileURLToPath(new URL('../seekly-open.js', import.meta.url)), join(dir, 'seekly-open.js'));
    writeFileSync(join(dir, 'seekly-open.compat.js'), 'stale');
    const run = (...args) => spawnSync(process.execPath, [join(dir, 'scripts/build-compat.mjs'), ...args], { encoding: 'utf8' });

    assert.equal(run('--check').status, 1, 'a stale compat script must fail --check');
    assert.equal(run().status, 0);
    assert.equal(readFileSync(join(dir, 'seekly-open.compat.js'), 'utf8'), COMPAT);
    assert.equal(run('--check').status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compat: seekly-open.compat.js is up to date', async () => {
  const { buildCompat } = await import('../scripts/build-compat.mjs');
  assert.equal(COMPAT, buildCompat(readFileSync(new URL('../seekly-open.js', import.meta.url), 'utf8')));
});
