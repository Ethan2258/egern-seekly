// Builds seekly-open.compat.js, the Surge / Loon / Stash / Shadowrocket
// version of seekly-open.js. Those apps run classic scripts with $request,
// $argument and $done instead of Egern's `export default (ctx)`, so the
// Egern handler is copied in unchanged and a small adapter calls it.
//
//   node scripts/build-compat.mjs           write seekly-open.compat.js
//   node scripts/build-compat.mjs --check   fail if it is out of date
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const source = new URL('../seekly-open.js', import.meta.url);
const target = new URL('../seekly-open.compat.js', import.meta.url);
const EXPORT = 'export default async function (ctx) {';

export function buildCompat(egern) {
  if (egern.split(EXPORT).length !== 2) throw new Error(`seekly-open.js must contain "${EXPORT}" exactly once`);
  const body = egern.replace(/^\/\*\*[\s\S]*?\*\/\n\n/, '').replace(EXPORT, 'async function handle(ctx) {');
  return `/**
 * NodeSeek → Seekly（Surge / Loon / Stash / Shadowrocket 版）
 *
 * 由 scripts/build-compat.mjs 根据 seekly-open.js 生成，请勿直接修改。
 * Generated from seekly-open.js by scripts/build-compat.mjs - do not edit.
 *
 * argument:
 *   Surge / Shadowrocket / Stash: "MODE=redirect" or "MODE=page"
 *   Loon: [Argument] MODE, passed as argument=[{MODE}]
 */

${body}
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
`;
}

// Run only when executed directly, not when imported by the tests. Compare
// URLs, not strings: import.meta.url percent-encodes spaces and non-ASCII
// characters (e.g. a checkout under ~/代码/), which a raw path does not.
function isMain() {
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch (e) {
    return false;
  }
}

if (isMain()) {
  const built = buildCompat(readFileSync(source, 'utf8'));
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== built) {
      console.error('✖ seekly-open.compat.js 已过期，请运行 npm run build');
      process.exit(1);
    }
    console.log('seekly-open.compat.js 与 seekly-open.js 一致');
  } else {
    writeFileSync(target, built);
    console.log('已生成 seekly-open.compat.js');
  }
}
