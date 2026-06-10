#!/usr/bin/env node
/**
 * WildwoodComponents parity check.
 *
 * Guards the two "must-match" parity dimensions between the .NET and JS stacks:
 *   1. Browser localStorage key names  (HARD CHECK — exits non-zero on mismatch)
 *   2. Backend API endpoint paths       (REPORT — heuristic, printed for review)
 *
 * Run:  node scripts/parity-check.mjs
 * Optionally override repo roots:  node scripts/parity-check.mjs <netDevRoot> <jsDevRoot>
 * Quiet mode (storage-key result only; used by git hooks):  add --quiet
 *
 * It would have caught the drift fixed in May 2026 (cancel-endpoint mismatch,
 * unprefixed localStorage keys). Wire it into CI / a pre-commit hook.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet') || argv.includes('-q');
const positional = argv.filter((a) => !a.startsWith('-'));
const NET_ROOT = positional[0] ?? 'C:/Development/WildwoodComponents.Net/Dev';
const JS_ROOT = positional[1] ?? 'C:/Development/WildwoodComponents.JS/Dev';

const IGNORE = new Set(['node_modules', 'bin', 'obj', 'dist', '.git', '.vs', '__tests__']);

function walk(dir, exts) {
  let files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (IGNORE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p, exts));
    else if (exts.includes(extname(e.name))) files.push(p);
  }
  return files;
}

function readAll(root, exts) {
  return walk(root, exts).map((f) => readFileSync(f, 'utf8')).join('\n');
}

// ---------- 1. Storage keys (ww_-prefixed) ----------
// Server-side .NET ww_ names that are NOT browser localStorage keys and so have no
// JS localStorage counterpart: auth-cookie token property names in
// WildwoodComponents.Razor/Authentication/AuthCookieTokenHelper.cs. Excluded so the
// localStorage parity check stays precise.
const NET_NON_LOCALSTORAGE = new Set(['ww_access_token', 'ww_refresh_token', 'ww_token_expiry']);

function wwKeys(text, exclude = new Set()) {
  const set = new Set();
  const re = /['"`](ww_[a-zA-Z0-9_]+)['"`]/g;
  let m;
  while ((m = re.exec(text))) {
    if (!exclude.has(m[1])) set.add(m[1]);
  }
  return set;
}

// ---------- 2. Endpoint paths ----------
const KNOWN_ROOTS = [
  'auth', 'app-tiers', 'app-tier-addons', 'ai', 'messaging', 'messages',
  'notifications', 'disclaimers', 'disclaimeracceptance', 'payment',
  'paymenttransactions', 'twofactor', 'webauthn', 'userregistration',
  'registrationtokens', 'appcomponentconfigurations', 'users',
  // 'subscription' has NO backend controller — the legacy SubscriptionService
  // was deleted from both stacks (June 2026); any hit here is a regression.
  'subscription',
];

function normEndpoint(p) {
  let s = p
    .replace(/\$\{[^}]*\}/g, '{}') // JS interpolation
    .replace(/\{[^}]*\}/g, '{}') //   .NET interpolation / route tokens
    .replace(/\?.*$/, '') //          query string
    .replace(/^\/+/, '') //           leading slash
    .replace(/^\{\}\//, '') //        interpolated base-url prefix ($"{_apiBaseUrl}/...")
    .replace(/^api\//, '') //         api/ prefix (.NET base addr already has it)
    .replace(/([^/])\{\}$/, '$1') //  trailing same-segment interpolation (`sessions${qs}`)
    .replace(/\/+$/, '') //           trailing slash
    .toLowerCase();
  return s;
}

function endpoints(text, regexes) {
  const set = new Set();
  for (const re of regexes) {
    let m;
    while ((m = re.exec(text))) {
      const n = normEndpoint(m[1]);
      const root = n.split('/')[0];
      if (KNOWN_ROOTS.includes(root)) set.add(n);
    }
  }
  return set;
}

const JS_EP = [
  // `<(?:[^<>]|<[^<>]*>)*>` tolerates one level of nested generics (e.g. get<Record<string, boolean>>)
  /\.(?:get|post|put|delete|patch)\s*(?:<(?:[^<>]|<[^<>]*>)*>)?\(\s*[`'"]([^`'"]+)[`'"]/g,
  /\bpostChat\s*\(\s*[`'"]([^`'"]+)[`'"]/g, // aiService chat helper
];
const NET_EP = [
  /(?:PostAsync|GetAsync|PutAsync|DeleteAsync|PatchAsync|GetFromJsonAsync|PostAsJsonAsync|PutAsJsonAsync|BuildUrl|SendAsync|PostChatAsync|PostChatWithFileAsync)\s*(?:<[^>]*>)?\(\s*\$?[`"]([^"`]+)[`"]/g,
];

function diff(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

// ---------- run ----------
if (!existsSync(NET_ROOT) || !existsSync(JS_ROOT)) {
  console.error(`✗ Repo root not found.\n  .NET: ${NET_ROOT}\n  JS:   ${JS_ROOT}`);
  process.exit(2);
}

const netCs = readAll(NET_ROOT, ['.cs']);
const jsTs = readAll(JS_ROOT, ['.ts', '.tsx']);

const netKeys = wwKeys(netCs, NET_NON_LOCALSTORAGE);
const jsKeys = wwKeys(jsTs);
const keyNetOnly = diff(netKeys, jsKeys);
const keyJsOnly = diff(jsKeys, netKeys);

const netEp = endpoints(netCs, NET_EP);
const jsEp = endpoints(jsTs, JS_EP);
const epNetOnly = diff(netEp, jsEp);
const epJsOnly = diff(jsEp, netEp);

console.log('=== Storage keys (ww_) ===');
console.log(`  .NET: ${netKeys.size}   JS: ${jsKeys.size}`);
if (keyNetOnly.length) console.log(`  ✗ .NET only: ${keyNetOnly.join(', ')}`);
if (keyJsOnly.length) console.log(`  ✗ JS only:   ${keyJsOnly.join(', ')}`);
const keysOk = keyNetOnly.length === 0 && keyJsOnly.length === 0;
console.log(keysOk ? '  ✓ storage keys aligned' : '  ✗ STORAGE KEY MISMATCH');

if (!QUIET) {
  console.log('\n=== Endpoint paths (heuristic report) ===');
  console.log(`  .NET: ${netEp.size}   JS: ${jsEp.size}`);
  console.log('  Note: one-sided entries may be legitimate (e.g. admin-only or server-only');
  console.log('  routes). Review — exact same logical op on different paths is a real bug.');
  if (epNetOnly.length) console.log(`\n  .NET-only paths:\n    ${epNetOnly.join('\n    ')}`);
  if (epJsOnly.length) console.log(`\n  JS-only paths:\n    ${epJsOnly.join('\n    ')}`);
  if (!epNetOnly.length && !epJsOnly.length) console.log('  ✓ endpoint sets match');
}

// Hard-fail only on the precise check (storage keys). Endpoints are advisory.
process.exit(keysOk ? 0 : 1);
