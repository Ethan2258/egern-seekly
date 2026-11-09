/**
 * NodeSeek → Seekly
 *
 * Egern http_request script. When a NodeSeek post link
 * (https://www.nodeseek.com/post-<id>-<page>) is opened in Safari, an in-app
 * browser (Telegram, etc.) or any other browser, answer the request locally
 * and hand the post over to the Seekly app via its URL scheme
 * `seekly://post/<id>`.
 *
 * The Seekly app's own traffic (it scrapes the same pages) is left alone.
 *
 * env:
 *   MODE = redirect  (default) bare 302 straight to seekly://post/<id>
 *   MODE = page      small landing page: opens Seekly at once and keeps
 *                    "Open in Seekly" / "Continue in browser" buttons
 *
 * Requests relayed by NodeSeek's service worker always get the landing page.
 */

// Seekly sends this fixed User-Agent for every request it makes itself
// (taken from the Seekly 5.2 binary). Never redirect those.
const SEEKLY_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const POST_RE =
  /^https?:\/\/(?:www\.)?nodeseek\.com\/post-(\d+)(?:-(\d+))?\/?(?:[?#].*)?$/i;

// Add ?seekly=0 to a post URL to view it in the browser without redirecting.
const BYPASS_RE = /[?&]seekly=0(?:&|#|$)/;

// Egern passes a Headers-like object; fall back to a plain object lookup
// (case-insensitive) so an older or different runtime still works.
function header(headers, name) {
  if (!headers) return '';
  try {
    if (typeof headers.get === 'function') return headers.get(name) || '';
    const wanted = name.toLowerCase();
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === wanted) return String(headers[key] || '');
    }
  } catch (e) {
    // Treat unreadable headers as missing.
  }
  return '';
}

// How a browser is asking for the post page:
//   'navigate' - a plain top-level page load (Sec-Fetch-Mode: navigate)
//   'worker'   - the same page load relayed by NodeSeek's service worker
//                (www.nodeseek.com/sw.js). Its fetch() turns the mode into
//                same-origin/cors, so only Sec-Fetch-Dest: document or an HTML
//                Accept header is left to recognise it.
//   null       - anything else: the Seekly app itself, API calls, iframes,
//                prefetches. Those are passed through untouched.
function classify(req) {
  const h = req.headers;
  const ua = header(h, 'User-Agent');
  if (!ua || ua === SEEKLY_UA) return null;
  if (/prefetch|prerender/i.test(header(h, 'Sec-Purpose') + header(h, 'Purpose'))) return null;

  const dest = header(h, 'Sec-Fetch-Dest').toLowerCase();
  const mode = header(h, 'Sec-Fetch-Mode').toLowerCase();
  const wantsHtml = /text\/html/i.test(header(h, 'Accept'));

  if (!dest && !mode) return wantsHtml ? 'navigate' : null; // no Fetch Metadata (older browsers)
  if (mode === 'navigate') return !dest || dest === 'document' ? 'navigate' : null;
  if (dest === 'document') return 'worker';
  if ((!dest || dest === 'empty') && wantsHtml) return 'worker';
  return null;
}

function bypassUrl(url) {
  const [base, hash] = url.split('#');
  const sep = base.includes('?') ? '&' : '?';
  return base + sep + 'seekly=0' + (hash !== undefined ? '#' + hash : '');
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function landingPage(postId, appUrl, webUrl) {
  const app = escapeHtml(appUrl);
  const web = escapeHtml(webUrl);
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>在 Seekly 中打开</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         font: 16px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
         background: #f5f5f7; color: #1d1d1f; }
  @media (prefers-color-scheme: dark) { body { background: #000; color: #f5f5f7; } }
  main { width: 100%; max-width: 360px; padding: 24px 16px; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { margin: 0 0 24px; opacity: .6; font-size: 14px; }
  a { display: block; padding: 14px; margin-top: 12px; border-radius: 14px; text-decoration: none; font-weight: 600; }
  .primary { background: #0a84ff; color: #fff; }
  .secondary { background: rgba(127,127,127,.18); color: inherit; }
</style>
</head>
<body>
<main>
  <h1>正在打开 Seekly…</h1>
  <p>NodeSeek 帖子 #${postId}</p>
  <a class="primary" href="${app}">在 Seekly 中打开</a>
  <a class="secondary" href="${web}">继续在浏览器中查看</a>
</main>
<script>location.href = ${JSON.stringify(appUrl)};</script>
</body>
</html>`;
}

export default async function (ctx) {
  const req = ctx.request;
  if (req.method !== 'GET') return;

  const m = req.url.match(POST_RE);
  if (!m || BYPASS_RE.test(req.url)) return;
  const kind = classify(req);
  if (!kind) return;

  const postId = m[1];
  const appUrl = `seekly://post/${postId}`;
  const mode = String((ctx.env && ctx.env.MODE) || 'redirect').toLowerCase();

  // A 302 to seekly:// does not survive a service worker's fetch(), so a
  // relayed request always gets the page, whose script opens Seekly.
  if (mode !== 'page' && kind === 'navigate') {
    return ctx.respond({
      status: 302,
      headers: { Location: appUrl, 'Cache-Control': 'no-store' },
      body: '',
    });
  }

  return ctx.respond({
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: landingPage(postId, appUrl, bypassUrl(req.url)),
  });
}
