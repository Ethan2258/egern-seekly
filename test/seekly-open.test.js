import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from '../seekly-open.js';

const SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const SEEKLY_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const NAVIGATE = { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' };

// Runs the script like Egern does and returns what it answered (undefined = passed through).
async function run(url, { headers = NAVIGATE, method = 'GET', env, plainHeaders = false } = {}) {
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

test('redirects a browser navigation to seekly://post/<id> by default', async () => {
  const response = await run('https://www.nodeseek.com/post-1038101-1');
  assert.equal(response.status, 302);
  assert.equal(response.headers.Location, 'seekly://post/1038101');
  assert.equal(response.headers['Cache-Control'], 'no-store');
});

test('accepts the bare domain, a trailing slash, a query and a hash', async () => {
  for (const url of [
    'https://nodeseek.com/post-42',
    'https://www.nodeseek.com/post-42-3/',
    'https://www.nodeseek.com/post-42-3?from=tg',
    'http://www.nodeseek.com/post-42#reply',
  ]) {
    assert.equal((await run(url))?.headers.Location, 'seekly://post/42', url);
  }
});

test('leaves the Seekly app, API calls, iframes and prefetches alone', async () => {
  const url = 'https://www.nodeseek.com/post-1-1';
  assert.equal(await run(url, { headers: { ...NAVIGATE, 'User-Agent': SEEKLY_UA } }), undefined);
  assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors' } }), undefined);
  assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Dest': 'iframe', 'Sec-Fetch-Mode': 'navigate' } }), undefined);
  assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, 'Sec-Fetch-Mode': 'no-cors' } }), undefined);
  assert.equal(await run(url, { headers: { 'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate' } }), undefined);
  assert.equal(await run(url, { method: 'POST' }), undefined);
});

test('falls back to Accept: text/html without Fetch Metadata', async () => {
  const url = 'https://www.nodeseek.com/post-7';
  assert.equal((await run(url, { headers: { 'User-Agent': SAFARI_UA, Accept: 'text/html,*/*' } }))?.status, 302);
  assert.equal(await run(url, { headers: { 'User-Agent': SAFARI_UA, Accept: 'application/json' } }), undefined);
});

test('?seekly=0 keeps the post in the browser', async () => {
  for (const url of [
    'https://www.nodeseek.com/post-9-1?seekly=0',
    'https://www.nodeseek.com/post-9-1?a=1&seekly=0',
    'https://www.nodeseek.com/post-9-1?seekly=0#reply',
  ]) {
    assert.equal(await run(url), undefined, url);
  }
  assert.equal((await run('https://www.nodeseek.com/post-9-1?seekly=01'))?.status, 302);
});

test('ignores non-post pages', async () => {
  for (const url of ['https://www.nodeseek.com/', 'https://www.nodeseek.com/space/1', 'https://www.nodeseek.com/post-abc']) {
    assert.equal(await run(url), undefined, url);
  }
});

test('MODE=page returns a landing page with both buttons and escaped links', async () => {
  const response = await run('https://www.nodeseek.com/post-5-2?q="><script>#top', { env: { MODE: 'PAGE' } });
  assert.equal(response.status, 200);
  assert.match(response.headers['Content-Type'], /^text\/html/);
  assert.match(response.body, /href="seekly:\/\/post\/5"/);
  assert.match(response.body, /href="https:\/\/www\.nodeseek\.com\/post-5-2\?q=&quot;&gt;&lt;script&gt;&amp;seekly=0#top"/);
  assert.doesNotMatch(response.body, /"><script>/);
  assert.match(response.body, /location\.href = "seekly:\/\/post\/5"/);
});

test('an unknown MODE falls back to the redirect', async () => {
  assert.equal((await run('https://www.nodeseek.com/post-3', { env: { MODE: 'nope' } }))?.status, 302);
});

test('reads plain-object headers case-insensitively', async () => {
  const headers = { 'user-agent': SAFARI_UA, 'sec-fetch-dest': 'document', 'sec-fetch-mode': 'navigate' };
  assert.equal((await run('https://www.nodeseek.com/post-11', { headers, plainHeaders: true }))?.status, 302);
});
