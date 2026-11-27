/**
 * NodeSeek → Seekly（Surge / Loon / Stash / Shadowrocket 版）
 *
 * 由 scripts/build-compat.mjs 根据 seekly-open.js 生成，请勿直接修改。
 * Generated from seekly-open.js by scripts/build-compat.mjs - do not edit.
 *
 * argument:
 *   Surge / Shadowrocket / Stash: "MODE=redirect" or "MODE=page"
 *   Loon: [Argument] MODE, passed as argument=[{MODE}]
 */

// Seekly sends this fixed User-Agent for every request it makes itself
// (taken from the Seekly 5.2 binary). Never redirect those.
const SEEKLY_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const POST_RE =
  /^https?:\/\/(?:www\.)?nodeseek\.com\/post-(\d+)(?:-(\d+))?\/?(?:[?#].*)?$/i;

// Shown on the landing page when Seekly does not open (most likely not installed).
const SEEKLY_DOWNLOAD = 'https://github.com/maow318/seekly-open/releases';

// Add ?seekly=0 to a post URL to view it in the browser without redirecting.
const BYPASS_RE = /[?&]seekly=0(?:&|#|$)/;

// Egern passes a Headers-like object, the other apps a plain object whose
// keys can be in any case. Returns a case-insensitive lookup that gives ''
// for a missing or unreadable header. A plain object is indexed once.
function headerReader(headers) {
  if (headers && typeof headers.get === 'function') {
    return (name) => {
      try {
        return String(headers.get(name) || '');
      } catch (e) {
        return '';
      }
    };
  }
  const byName = {};
  try {
    for (const key of Object.keys(headers || {})) byName[key.toLowerCase()] = String(headers[key] || '');
  } catch (e) {
    // Treat unreadable headers as missing.
  }
  return (name) => byName[name.toLowerCase()] || '';
}

// How a browser is asking for the post page:
//   'navigate' - a plain top-level page load (Sec-Fetch-Mode: navigate)
//   'worker'   - the same page load relayed by NodeSeek's service worker
//                (www.nodeseek.com/sw.js). Its fetch() turns the mode into
//                same-origin/cors, so only Sec-Fetch-Dest: document or an HTML
//                Accept header is left to recognise it.
//   null       - anything else: the Seekly app itself, API calls, iframes,
//                prefetches and link previews. Those are passed through untouched.
function classify(req) {
  const header = headerReader(req.headers);
  const ua = header('User-Agent');
  if (!ua || ua === SEEKLY_UA) return null;
  // Sec-Purpose (current browsers), Purpose (older Chrome), X-Purpose (Safari
  // previews) and X-Moz (Firefox) mark loads the user did not open.
  const purpose = header('Sec-Purpose') + header('Purpose') + header('X-Purpose') + header('X-Moz');
  if (/prefetch|prerender|preview/i.test(purpose)) return null;

  const dest = header('Sec-Fetch-Dest').toLowerCase();
  const mode = header('Sec-Fetch-Mode').toLowerCase();
  const wantsHtml = /text\/html/i.test(header('Accept'));

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

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
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
  .btn { display: block; padding: 14px; margin-top: 12px; border-radius: 14px; text-decoration: none; font-weight: 600; }
  .primary { background: #0a84ff; color: #fff; }
  .secondary { background: rgba(127,127,127,.18); color: inherit; }
  .hint { margin: 20px 0 0; }
  .hint a { color: #0a84ff; }
</style>
</head>
<body>
<main>
  <h1>正在打开 Seekly…</h1>
  <p>NodeSeek 帖子 #${postId}</p>
  <a class="btn primary" href="${app}">在 Seekly 中打开</a>
  <a class="btn secondary" href="${web}">继续在浏览器中查看</a>
  <p class="hint" hidden>没有自动打开？点上面的按钮重试。还没装 Seekly 的话，先去<a href="${SEEKLY_DOWNLOAD}">下载 Seekly</a>。</p>
</main>
<script>
(function () {
  // Once Seekly opens, Safari hides this page; if it is still showing a few
  // seconds later, the jump was blocked or Seekly is not installed.
  var hint = document.querySelector('.hint');
  var left = false;
  function away() { left = true; hint.hidden = true; }
  document.addEventListener('visibilitychange', function () { if (document.hidden) away(); });
  window.addEventListener('pagehide', away);
  setTimeout(function () { if (!left) hint.hidden = false; }, 2500);
  location.href = ${JSON.stringify(appUrl)};
})();
</script>
</body>
</html>`;
}

async function handle(ctx) {
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

// ---- Surge / Loon / Stash / Shadowrocket adapter ----

// Accepts every shape these apps hand to $argument: "MODE=page&x=1" (Surge,
// Stash, Shadowrocket), {MODE: "page"} (Loon [Argument]), ["page"], a JSON
// string or a bare "page". An unexpanded placeholder such as "{{{MODE}}}"
// is just an unknown MODE, which the handler treats as redirect.
function parseArgument(arg) {
  const out = {};
  if (arg === undefined || arg === null) return out;
  if (Array.isArray(arg)) {
    if (arg.length) out.MODE = String(arg[0]);
    return out;
  }
  if (typeof arg === 'object') {
    for (const key of Object.keys(arg)) out[key] = String(arg[key]);
    return out;
  }
  const text = String(arg).trim();
  if (!text) return out;
  if (/^[[{]/.test(text)) {
    try {
      return parseArgument(JSON.parse(text));
    } catch (e) {
      // Not JSON after all; parse it as key=value below.
    }
  }
  if (!text.includes('=')) {
    out.MODE = text;
    return out;
  }
  for (const part of text.split('&')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const decode = (s) => {
      try {
        return decodeURIComponent(s.trim());
      } catch (e) {
        return s.trim();
      }
    };
    out[decode(part.slice(0, i))] = decode(part.slice(i + 1));
  }
  return out;
}

(async () => {
  let response;
  try {
    const req = typeof $request !== 'undefined' ? $request : {};
    await handle({
      request: {
        url: String(req.url || ''),
        method: String(req.method || 'GET').toUpperCase(),
        headers: req.headers || {},
      },
      env: parseArgument(typeof $argument !== 'undefined' ? $argument : undefined),
      respond(value) {
        response = value;
        return value;
      },
    });
  } catch (e) {
    console.log('[NodeSeek → Seekly] ' + (e && e.stack ? e.stack : e));
  }
  $done(response ? { response } : {});
})();
