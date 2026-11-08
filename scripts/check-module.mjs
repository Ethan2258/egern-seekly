// Consistency checks for seekly.yaml, without a YAML dependency: the module's
// match pattern, script URL, MITM hosts and default MODE must agree with
// seekly-open.js and the README.
import { readFileSync } from 'node:fs';

const yaml = readFileSync(new URL('../seekly.yaml', import.meta.url), 'utf8');
const script = readFileSync(new URL('../seekly-open.js', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const problems = [];

// Double-quoted YAML scalar value of `key:` (only simple escapes are used).
function value(key) {
  const m = yaml.match(new RegExp(`^\\s*(?:- )?${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*$`, 'm'));
  if (!m) {
    problems.push(`seekly.yaml: missing ${key}`);
    return '';
  }
  return m[1].replace(/\\(.)/g, '$1');
}

const repoRaw = 'https://raw.githubusercontent.com/Ethan2258/egern-seekly/main/';
if (value('script_url') !== `${repoRaw}seekly-open.js`) {
  problems.push(`seekly.yaml: script_url should be ${repoRaw}seekly-open.js`);
}
if (!readme.includes(`${repoRaw}seekly.yaml`)) {
  problems.push('README.md: install URL should point at seekly.yaml on main');
}

let match;
try {
  match = new RegExp(value('match'));
} catch (error) {
  problems.push(`seekly.yaml: match is not a valid regex (${error.message})`);
}
const postRe = new RegExp(script.match(/const POST_RE =\s*\/(.+)\/([a-z]*);/)[1], 'i');
const samples = {
  'https://www.nodeseek.com/post-1038101-1': true,
  'https://nodeseek.com/post-1038101': true,
  'http://www.nodeseek.com/post-42-3?x=1#reply': true,
  'https://www.nodeseek.com/': false,
  'https://www.nodeseek.com/space/1': false,
  'https://www.nodeseek.com/api/post-1': false,
  'https://evil.example/post-1?https://www.nodeseek.com/post-1': false,
};
for (const [url, expected] of Object.entries(samples)) {
  if (match && match.test(url) !== expected) problems.push(`seekly.yaml match: ${url} should ${expected ? '' : 'not '}match`);
  if (postRe.test(url) && match && !match.test(url)) problems.push(`POST_RE accepts ${url} but seekly.yaml does not`);
}

const hosts = [...yaml.matchAll(/^\s+- "([^"]+)"\s*$/gm)].map((m) => m[1]);
for (const host of ['nodeseek.com', 'www.nodeseek.com']) {
  if (!hosts.includes(host)) problems.push(`seekly.yaml: mitm hostnames should include ${host}`);
}

const yamlMode = value('MODE');
const scriptMode = script.match(/\|\| '([a-z]+)'\)\.toLowerCase\(\)/)?.[1];
if (yamlMode !== 'redirect' || scriptMode !== 'redirect' || !/`redirect`（默认）/.test(readme)) {
  problems.push(`default MODE differs: seekly.yaml=${yamlMode}, script=${scriptMode}; README should say redirect（默认）`);
}

if (problems.length) {
  console.error(problems.map((p) => `✖ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`seekly.yaml 检查通过：${Object.keys(samples).length} 个链接样例，MITM ${hosts.join(', ')}`);
