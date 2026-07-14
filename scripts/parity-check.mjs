#!/usr/bin/env node
/**
 * WildwoodComponents parity check.
 *
 * Guards the two "must-match" parity dimensions between the .NET, JS, and Swift stacks:
 *   1. Storage key names (ww_ prefix)   (HARD CHECK — exits non-zero on mismatch)
 *   2. Backend API endpoint paths       (REPORT — heuristic, printed for review)
 *
 * Run:  node scripts/parity-check.mjs
 * Optionally override repo roots:  node scripts/parity-check.mjs <netDevRoot> <jsDevRoot> <swiftDevRoot>
 * Quiet mode (storage-key result only; used by git hooks):  add --quiet
 *
 * The Swift repo is optional: when its root is absent the check runs 2-way
 * (.NET + JS) so the script stays usable on checkouts without the Swift tree.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const argv = process.argv.slice(2);
const QUIET = argv.includes('--quiet') || argv.includes('-q');
const positional = argv.filter((a) => !a.startsWith('-'));
const NET_ROOT = positional[0] ?? 'C:/Development/WildwoodComponents.Net/Dev';
const JS_ROOT = positional[1] ?? 'C:/Development/WildwoodComponents.JS/Dev';
const SWIFT_ROOT = positional[2] ?? 'C:/Development/WildwoodComponents.Swift/Dev';

const IGNORE = new Set([
  'node_modules', 'bin', 'obj', 'dist', '.git', '.vs', '__tests__',
  // Swift build output and test sources (Tests mirrors the __tests__ exclusion)
  '.build', '.swiftpm', 'DerivedData', 'Tests',
  // JS e2e specs use route-name literals ('messaging', 'subscription') that are
  // not endpoints — excluding them keeps the generic literal extraction precise.
  'e2e',
]);

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
    // Test projects assert on endpoint strings with fixture ids ('app-tiers/app-1') —
    // exclude *.Tests dirs (e.g. WildwoodComponents.Tests) like __tests__/Tests.
    if (e.isDirectory()) {
      if (!e.name.endsWith('.Tests')) files = files.concat(walk(p, exts));
    }
    // Storybook titles ('ai/AIChatComponent') and test/spec fixture literals look
    // like endpoint paths — skip those files.
    else if (exts.includes(extname(e.name)) && !/\.(stories|test|spec)\./.test(e.name)) {
      files.push(p);
    }
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

// First-party COOKIE names (not browser localStorage keys) that are managed in JS for every web
// host and have no native/Swift counterpart. Excluded from all stacks so the localStorage parity
// check stays precise. ww_consent is the Consent SDK's first-party consent cookie.
const COOKIE_NAMES = new Set(['ww_consent']);

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
  // 'documents' — tenant DocumentService (JS PR #5; ported to .NET + Swift July 2026).
  // Heads-up: JS assembles document URLs through a private DocumentService.url() helper
  // (`${base}/documents${path}`), so — like the notification-inbox and ai-flow-subscription
  // services — its paths are never root-anchored quoted literals and won't be extracted.
  // The .NET (`$"{_apiBaseUrl}/documents/..."`) and Swift (`"api/documents/..."`) literals
  // ARE extracted, so `documents/*` shows as one-sided "missing from JS". That is a KNOWN
  // JS-helper extractor blind spot (see the note below), NOT a real gap — the reason to
  // track 'documents' anyway is to catch .NET-vs-Swift path divergence between the two
  // fresh ports.
  'documents',
  // 'subscription' has NO backend controller — the legacy SubscriptionService
  // was deleted from both stacks (June 2026); any hit here is a regression.
  'subscription',
];

// ---------- Known one-sided endpoints (advisory-report false positives) ----------
// The endpoint report below is heuristic and one-sided entries are expected in three
// documented cases. These are NOT client bugs; they are recorded here so the report stays
// interpretable and future maintainers don't "fix" a non-problem:
//
//   1. HELPER-ASSEMBLED URLs (extractor blind spot) — several services build a URL from a base
//      held in a private helper (JS `url()`/`apiBase()`; .NET `BaseRoute()`), passing only the
//      tail segment at the call site. The root and the tail never appear in one string literal,
//      so the extractor cannot reconstruct them. The paths DO match across stacks; only where
//      they are extractable differs:
//        · JS extracts ZERO paths for notifications/*, documents/*, and ai/flows/subscriptions*
//          (all assembled via a helper) — they always print "missing from JS".
//        · .NET builds the subscription SUB-paths as `$"{BaseRoute()}/{id}/enable"`, so only the
//          base `ai/flows/subscriptions` extracts (from BaseRoute()'s own literal); the /{},
//          /{}/enable, /{}/disable, /{}/latest-run variants print "missing from .NET".
//        · Swift writes full literals, but the bare list/upload roots ("api/documents",
//          "api/ai/flows/subscriptions") have no trailing `/segment`, which GENERIC_LITERAL
//          intentionally requires (so bare route-name strings don't match) — so bare `documents`
//          prints "missing from Swift".
//      All verified equivalent by reading the services directly. See KNOWN_BENIGN_ONE_SIDED below.
//
//   2. PAYMENT DEMO ENDPOINTS — `payment/process`, `payment/refund`, `payment/status/{}` exist
//      only in .NET PaymentService.cs, which documents them as HOST-supplied endpoints for the
//      raw-card PaymentFormComponent demo, explicitly NOT built-in WildwoodAPI routes. The real
//      cross-stack flow (`payment/initiate` / `payment/confirm` / `payment/validate-*-receipt`)
//      is fully at parity. `payment/process` is not the same logical op as initiate/confirm.
//
//   3. RAZOR SERVER-RENDER VARIANT — `registrationtokens/validate-detailed/{}` is called only by
//      .NET Razor (WildwoodRegistrationService) to prefetch rich token info for server-side page
//      rendering. Blazor, JS, and Swift all use the lightweight boolean `validate-simple/{}` (at
//      parity). This is an idiomatic divergence, not a client bug.
//
//   4. SERVER-ONLY SEEDER COMPONENT — `appcomponentconfigurations/{}/seeder-configuration`,
//      `.../seeder/ledger`, `.../seeder/history` are the Seeder's ledger/history/config routes.
//      The Seeder is a server-side app-data provisioning harness (CompanyAdmin service-account
//      login, startup seeding) that ships in .NET `WildwoodComponents.Shared/Seeder` and JS
//      `@wildwood/node` (the server SDK, alongside AdminClient). It has NO browser/mobile client
//      counterpart — the Swift stack is a pure iOS client with no server host, the same reason
//      `@wildwood/node` itself has no Swift equivalent. So these three routes are legitimately
//      present in .NET + JS and absent from Swift. Not drift; a server-only component by design.

// Normalized one-sided endpoints that are documented-benign per the cases above. The report
// partitions these out of the "REVIEW" list so a genuine divergence stands out (they are still
// counted and summarized, never silently hidden). Add an entry ONLY after verifying — by reading
// the services — that the endpoint truly matches across stacks and merely fails to extract
// somewhere. Anything one-sided and NOT in this set prints under "REVIEW" as a real signal.
const KNOWN_BENIGN_ONE_SIDED = new Set([
  // Helper-assembled (JS url() / .NET BaseRoute()) + Swift bare-root literal skips:
  'notifications/count', 'notifications/preferences', 'notifications/read-all',
  'notifications/{}', 'notifications/{}/read',
  'documents', 'documents/{}', 'documents/{}/text', 'documents/{}/download',
  'ai/flows/subscriptions', 'ai/flows/subscriptions/{}', 'ai/flows/subscriptions/{}/enable',
  'ai/flows/subscriptions/{}/disable', 'ai/flows/subscriptions/{}/latest-run',
  // .NET PaymentFormComponent host-supplied demo endpoints (not Wildwood routes):
  'payment/process', 'payment/refund', 'payment/status/{}',
  // Razor server-render-only token-detail variant (others use validate-simple):
  'registrationtokens/validate-detailed/{}',
  // Server-only Seeder component (.NET Shared + @wildwood/node); no Swift/iOS-client
  // counterpart — same class as @wildwood/node having no Swift equivalent (case 4 above):
  'appcomponentconfigurations/{}/seeder-configuration',
  'appcomponentconfigurations/{}/seeder/ledger',
  'appcomponentconfigurations/{}/seeder/history',
]);

function normEndpoint(p) {
  let s = p
    .replace(/\\\((?:[^()]|\([^()]*\))*\)/g, '{}') // Swift interpolation \(expr) (one nesting level)
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

// Generic endpoint-literal extraction: any quoted single-line literal that is an API
// path rooted at a known controller root (optionally 'api/'-prefixed), regardless of
// the call-site idiom. This catches URL shapes no per-callsite regex anticipates —
// ternaries picking an endpoint into a const, helper-function arguments, `url =`
// assemblies — which previously went silently missing from the report (e.g. JS
// payment/validate-apple-receipt behind a ternary). A '/' after the root is required
// so bare route names ('messaging') and view-state strings ('disclaimers') don't
// match; whitespace is excluded so quoted prose and multi-line templates don't.
const ROOT_ALT = KNOWN_ROOTS.join('|');
const GENERIC_LITERAL = (quotes) =>
  // Case-insensitive: some stacks write PascalCase roots ('api/AppComponentConfigurations/…');
  // normEndpoint lowercases afterwards, so matching must not be stricter than normalization.
  new RegExp(`[${quotes}](/?(?:api/)?(?:${ROOT_ALT})/[^${quotes}\\s]+)[${quotes}]`, 'gi');

const JS_EP = [
  GENERIC_LITERAL("`'\""),
  // Interpolated-prefix URLs the generic rule can't anchor: AIFlowService's fetch
  // transport builds `${this.apiBase(options)}/ai/flows...` template literals
  // (SSE needs a raw stream, so it bypasses the shared HttpClient verbs).
  /[`]\$\{this\.apiBase\((?:[^()]|\([^()]*\))*\)\}(\/[^`]+)[`]/g,
];
const NET_EP = [
  GENERIC_LITERAL('"'),
  // Interpolated-prefix URLs the generic rule can't anchor, e.g.
  // `$"{_apiBaseUrl}/ai/flows/..."` (verb-call or `var url =` alike).
  /\$"\{[^}]*\}(\/[^"\s]+)"/g,
];
const SWIFT_EP = [
  GENERIC_LITERAL('"'),
];

function diff(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

// ---------- run ----------
if (!existsSync(NET_ROOT) || !existsSync(JS_ROOT)) {
  console.error(`✗ Repo root not found.\n  .NET: ${NET_ROOT}\n  JS:   ${JS_ROOT}`);
  process.exit(2);
}
const HAS_SWIFT = existsSync(SWIFT_ROOT);
if (!HAS_SWIFT && !QUIET) {
  console.log(`(Swift root not found at ${SWIFT_ROOT} — running 2-way .NET/JS check)\n`);
}

const netCs = readAll(NET_ROOT, ['.cs']);
const jsTs = readAll(JS_ROOT, ['.ts', '.tsx']);
const swiftSrc = HAS_SWIFT ? readAll(SWIFT_ROOT, ['.swift']) : '';

// [stackName, keySet, endpointSet]
const stacks = [
  ['.NET', wwKeys(netCs, new Set([...NET_NON_LOCALSTORAGE, ...COOKIE_NAMES])), endpoints(netCs, NET_EP)],
  ['JS', wwKeys(jsTs, COOKIE_NAMES), endpoints(jsTs, JS_EP)],
];
if (HAS_SWIFT) {
  stacks.push(['Swift', wwKeys(swiftSrc, COOKIE_NAMES), endpoints(swiftSrc, SWIFT_EP)]);
}

const keyUnion = new Set(stacks.flatMap(([, keys]) => [...keys]));
let keysOk = true;

console.log('=== Storage keys (ww_) ===');
console.log(`  ${stacks.map(([name, keys]) => `${name}: ${keys.size}`).join('   ')}`);
for (const [name, keys] of stacks) {
  const missing = diff(keyUnion, keys);
  if (missing.length) {
    keysOk = false;
    console.log(`  ✗ missing in ${name}: ${missing.join(', ')}`);
  }
}
console.log(keysOk ? '  ✓ storage keys aligned' : '  ✗ STORAGE KEY MISMATCH');

if (!QUIET) {
  console.log('\n=== Endpoint paths (heuristic report) ===');
  console.log(`  ${stacks.map(([name, , ep]) => `${name}: ${ep.size}`).join('   ')}`);
  console.log('  One-sided entries are partitioned below. Anything under REVIEW is a real signal');
  console.log('  (the same logical op on different paths is a bug); documented extraction');
  console.log('  artifacts / legitimate one-sided routes are summarized under "known-benign".');

  const epUnion = new Set(stacks.flatMap(([, , ep]) => [...ep]));
  let reviewCount = 0;
  let benignCount = 0;
  for (const [name, , ep] of stacks) {
    const missing = diff(epUnion, ep);
    if (!missing.length) continue;
    const review = missing.filter((e) => !KNOWN_BENIGN_ONE_SIDED.has(e));
    benignCount += missing.length - review.length;
    if (review.length) {
      reviewCount += review.length;
      console.log(`\n  ⚠ Missing from ${name} — REVIEW (present in another stack):\n    ${review.join('\n    ')}`);
    }
  }

  if (reviewCount === 0) {
    console.log('\n  ✓ No unexpected endpoint divergences.');
  }
  if (benignCount) {
    console.log(`\n  ${benignCount} known-benign one-sided entr${benignCount === 1 ? 'y' : 'ies'} suppressed`);
    console.log('  (see "Known one-sided endpoints" / KNOWN_BENIGN_ONE_SIDED above):');
    console.log('    • JS assembles notifications/*, documents/*, ai/flows/subscriptions* via a private');
    console.log('      url() helper; .NET assembles the subscription sub-paths via BaseRoute(); Swift\'s');
    console.log('      bare documents list/upload literal has no trailing /segment — none extract there.');
    console.log('    • payment/process|refund|status — .NET PaymentFormComponent host-demo endpoints.');
    console.log('    • registrationtokens/validate-detailed/{} — Razor server-render-only variant.');
    console.log('    • appcomponentconfigurations/{}/seeder-configuration|seeder/ledger|seeder/history —');
    console.log('      server-only Seeder component (.NET Shared + @wildwood/node); no Swift/iOS client.');
  }
}

// Hard-fail only on the precise check (storage keys). Endpoints are advisory.
process.exit(keysOk ? 0 : 1);
