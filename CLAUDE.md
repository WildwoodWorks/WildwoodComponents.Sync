# WildwoodComponents.Sync

## Overview

Coordination workspace for the WildwoodComponents ecosystem — a component library implemented in .NET, JavaScript, and Swift that provides authentication, AI, messaging, payments, subscriptions, notifications, and more.

These are completely separate technology stacks. Each project is independent with its own shared library — there is no cross-project shared code.

## Repository Structure

This repo (`WildwoodComponents.Sync`) is a meta-repository that coordinates development across three sibling projects:

| Project | Path | Description |
|---------|------|-------------|
| **WildwoodComponents.Net** | `C:\Development\WildwoodComponents.Net\Dev` | .NET 10 component library (Blazor + Razor) |
| **WildwoodComponents.JS** | `C:\Development\WildwoodComponents.JS\Dev` | TypeScript SDK monorepo (React + React Native + Node.js) |
| **WildwoodComponents.Swift** | `C:\Development\WildwoodComponents.Swift\Dev` | Swift Package Manager package (SwiftUI, iOS 26+, Swift 6 strict concurrency) |

The VS Code workspace file (`WildwoodComponents.code-workspace`) opens all projects side-by-side.

## Architecture

### .NET Architecture (WildwoodComponents.Net)

Self-contained .NET solution with its own internal shared library:

```
WildwoodComponents.Shared          ← .NET shared library: models, DTOs, utilities
  ├─► WildwoodComponents.Blazor    ← Blazor interactive components (29 components)
  ├─► WildwoodComponents.Razor     ← Razor ViewComponents for MVC (29 components)
  └─► WildwoodComponents.WebForms  ← classic WebForms user controls, .NET Framework 4.8
```

- **WildwoodComponents.Shared** is the .NET-internal shared library. It holds models (`AppTierModels`, `WildwoodAuthModels`, `PaymentProviderModels`, etc.), utilities (`FormatHelpers`, `TokenExpiryParser`, `SessionConstants`), and is consumed by both Blazor and Razor projects within the .NET solution. It also hosts the framework-neutral **Seeder** (`Seeder/`) — a server-side app-data provisioning harness (idempotent `ISeederTask`s, `SeederApiClient`, topo-sorting `SeederRunner`, auto-startup `SeederRunnerService`) that any .NET host can adopt. As of July 2026 the seeder authenticates X-API-Key-first (an app API key minted with the `tiers:manage` scope); CompanyAdmin login and pre-issued bearer tokens are deprecated fallbacks.
- **WildwoodComponents.Blazor** has its own services layer, base component class (`BaseWildwoodComponent`), JS interop scripts, and payment script providers.
- **WildwoodComponents.Razor** has its own services layer (server-side HTTP calls), ViewComponent classes, Razor views, cookie auth helpers, and middleware.
- **WildwoodComponents.WebForms** (August 2026) targets **.NET Framework 4.8** — WebForms was never carried forward past it, and 4.8 is the last universal release (installs back to Windows 7 SP1 / Server 2008 R2 SP1, in-place upgrade from 4.5–4.7.2; 4.6.2–4.7.2 leave support 2027-01-12 and 4.8.1 is Windows 11 / Server 2022+ only). It consumes `WildwoodComponents.Shared` through a new `netstandard2.0` leg (the Seeder is excluded from it). Delivery is a compiled DLL plus **NuGet content**: `.ascx` user controls and `.ashx` proxy handlers whose `Inherits=`/`Class=` name compiled base classes, so consumers build nothing. See the WebForms rules in the .Net repo's CLAUDE.md before touching it — the no-nested-`<form>` rule, the shared-asset rule, and the per-request-token rule are all load-bearing. **Phase A only** so far: Authentication and TwoFactorSettings.
- **Test Suite**: `WildwoodComponentsTestSuiteBlazor` — Blazor web app with 24 test pages.

### JS Architecture (WildwoodComponents.JS)

Self-contained pnpm monorepo with its own internal shared library:

```
@wildwood/core                   ← JS shared library: services, types, utilities (framework-agnostic TS)
  ├─► @wildwood/react-shared     ← Shared React hooks (business logic, no UI)
  │     ├─► @wildwood/react      ← React components + hooks (59 components, 21 hooks)
  │     └─► @wildwood/react-native ← React Native components (31 components)
  └─► @wildwood/node             ← Node.js/Express middleware + admin client
```

- **@wildwood/core** is the JS-internal shared library. Pure TypeScript, zero UI dependencies. Contains `AuthService`, `AIService`, `MessagingService`, `PaymentService`, `TwoFactorService`, `CaptchaService`, `AppTierService`, `DisclaimerService`, `NotificationService`, `ThemeService`, `WildwoodEventEmitter`, `WildwoodClient`, and all shared types. Consumed by all other JS packages.
- **@wildwood/react-shared** holds 23 hooks with pure business logic (no UI) shared between React web and React Native.
- **@wildwood/react** wraps core services with React components and re-exports shared hooks.
- **@wildwood/react-native** provides native mobile components using the same shared hooks.
- **@wildwood/node** provides Express middleware (`authMiddleware`, `rateLimitMiddleware`, `proxyMiddleware`), `adminClient` for server-to-server operations, and the **Seeder** (`seeder/` — `SeederRunner`/`runSeeder`, the server-side app-data seeding harness ported from .NET `WildwoodComponents.Shared/Seeder`). The Seeder is server-only (CompanyAdmin login + startup seeding) and so has no `@wildwood/core`, react, react-native, or Swift counterpart — the same reason `@wildwood/node` itself has no Swift equivalent.
- **Test Suite**: `WildwoodComponentsTestSuite.React` — Vite + React app with 14 test pages.

### Swift Architecture (WildwoodComponents.Swift)

Self-contained SPM package (two products) with its own internal shared library:

```
WildwoodCore                     ← Swift shared library: services, models, session/token mgmt (zero UI imports)
  └─► WildwoodSwiftUI            ← SwiftUI components (31) + @Observable view models
        ├─ ViewModels/           ← ≈ @wildwood/react-shared (no `import SwiftUI`)
        └─ Components/           ← ≈ @wildwood/react-native (iOS-gated)
```

- **WildwoodCore** mirrors `@wildwood/core` method-for-method: `WildwoodClient` factory exposing `auth`, `session`, `ai`, `messaging`, `payment`, `appTier`, `twoFactor`, `captcha`, `disclaimer`, `feedback`, `notifications`, `theme`, `events`, `http`. Swift 6 strict concurrency: `WildwoodHttpClient` is an actor; `SessionManager`/`NotificationService`/`ThemeService` are `@MainActor @Observable`. Tokens go to the Keychain, other `ww_` keys to UserDefaults (CompositeStorage).
- **Payments are processor-agnostic**: provider selection is backend-driven via `PlatformFilteredProvidersDto`; the App Store path runs StoreKit 2 and validates JWS against `api/payment/validate-apple-receipt`, others use generic `initiatePayment`/`confirmPayment` with web checkout — all payment/subscription state remains in Wildwood.
- **Test Suite**: `WildwoodComponentsTestSuite.iOS` — XcodeGen-defined SwiftUI app with 19 test screens (`project.yml` checked in, `.xcodeproj` generated on a Mac).
- iOS 26 minimum deployment; iOS 27 features behind `@available(iOS 27, *)`. Builds/tests require macOS (Xcode 27 beta); code can be authored on Windows.

### Shared Library Equivalence

Each project has its own shared library serving the same purpose within its tech stack:

| .NET (internal) | JS (internal) | Swift (internal) | Purpose |
|------|----|----|---------|
| `WildwoodComponents.Shared` | `@wildwood/core` | `WildwoodCore` | Shared models, types, utilities for the project |
| (within Blazor services) | `@wildwood/react-shared` | `WildwoodSwiftUI/ViewModels` | Shared business logic between component sets |
| `WildwoodComponents.Blazor` | `@wildwood/react` | `WildwoodSwiftUI` | Interactive components |
| `WildwoodComponents.Razor` | `@wildwood/react-native` | (single UI framework) | Alternative platform components |
| `WildwoodComponents.WebForms` | (no equivalent) | (no equivalent) | Legacy-host components (.NET Framework 4.8) |
| (no equivalent) | `@wildwood/node` | (no equivalent) | Server-side SDK |

## Component Inventory (27 components at parity)

All three stacks implement these components:
- **AI**: AIChatComponent, AIProxyComponent, AIFlowComponent (July 2026 — app-facing "AI Flows with LangChain": SSE-streamed runs of published LangGraph flows with human-in-the-loop interrupts and run history; a NEW feature, unrelated to the obsolete AIFlow deleted May 2026)
- **Auth**: AuthenticationComponent, TokenRegistrationComponent, SignupWithSubscriptionComponent
- **Subscriptions**: SubscriptionAdminComponent (+ 6 admin sub-panels: StatusPanel, TierPlansPanel, FeaturesPanel, AddOnsPanel, UsageLimitsPanel, OverridesPanel) — tier-based; the legacy SubscriptionComponent/SubscriptionManagerComponent were removed June 2026 (they targeted a nonexistent `api/subscription/*` backend)
- **Payment**: PaymentComponent, PaymentFormComponent
- **Pricing/Tiers**: PricingDisplayComponent, AppTierComponent
- **Feature gating**: FeatureGate (July 2026 — cached fail-open entitlement gate over `user-features`; React/RN components + `useFeatures`, Blazor `FeatureGateComponent` + `IFeatureEntitlementService`, Swift `FeatureGate` view + `FeatureStore`; Razor idiomatically uses server-side `HasFeatureAsync` in `@if` blocks instead of a ViewComponent)
- **Security**: TwoFactorSettingsComponent
- **Messaging**: SecureMessagingComponent
- **Notifications**: NotificationComponent, NotificationToastComponent
- **Usage**: UsageDashboardComponent, OverageSummaryComponent
- **Legal**: DisclaimerComponent, ConsentComponent
- **Feedback**: FeedbackComponent

## Commands

### .NET
```bash
cd C:\Development\WildwoodComponents.Net\Dev
dotnet build                    # Build all projects
dotnet run --project WildwoodComponentsTestSuiteBlazor  # Run test suite
```

### JS
```bash
cd C:\Development\WildwoodComponents.JS\Dev
pnpm install                    # Install all deps
pnpm -r build                   # Build all packages
cd WildwoodComponentsTestSuite.React && pnpm dev  # Run test suite (port 5280)
pnpm -r test                    # Run all tests
```

### Swift (macOS only — code is authored on Windows, built on a Mac/CI)
```bash
cd /path/to/WildwoodComponents.Swift/Dev
swift build                     # Build the package
swift test                      # Run unit tests (swift-testing)
cd WildwoodComponentsTestSuite.iOS && xcodegen generate   # Generate the test app project
open WildwoodComponentsTestSuite.xcodeproj                # Run in the iOS simulator
```

## Parity

The purpose of this Sync workspace is to track parity between the independent projects. They implement the same component library for the same backend API, so their models, service methods, and component features should stay aligned — but each implementation is idiomatic to its own tech stack.

Key parity dimensions:
- **Models/types** — Should match field-for-field (adjusted for naming conventions: PascalCase .NET, camelCase JS/Swift)
- **Service methods** — Should cover the same API endpoints
- **Components** — Should provide the same user-facing features
- **API endpoint paths** — All projects call the same WildwoodAPI backend, so endpoint paths must match. Swift passes endpoints as double-quoted string literals to `WildwoodHttpClient` verb methods so the parity script can extract them.
- **Storage keys** — Key names share the `ww_` prefix across stacks (browser localStorage in .NET/JS; Keychain/UserDefaults in Swift via `WildwoodStorageKeys`)

`scripts/parity-check.mjs` runs the 3-way check (storage keys hard-fail; endpoints advisory). The Swift root is optional, so the script still works on 2-way checkouts.

The script walks every `.cs` file under the .NET root, so `WildwoodComponents.WebForms`
is already covered without a fourth root — which is also why its services must write
endpoints as interpolated strings like the other stacks. Concatenating an id onto a
literal (`"twofactor/configuration/" + id`) extracts as a *different* path from
`$"twofactor/configuration/{id}"` and shows up as a false one-sided entry.

### Known backend-only API surfaces (2026-07-27 audit)

WildwoodAPI surfaces that intentionally have **no SDK counterpart in any stack** — their absence is not a parity gap:

- **AI relay** (`POST api/ai/relay`, `/stream`, incl. the `EnableWebSearch` flag, 2026-07-15) — a backend relay surface; the SDKs use `api/ai/chat` / `api/ai/proxy`.
- **Service-key file/document surfaces** (`api/apps/{appId}/files/service`, `api/apps/{appId}/documents/service`) — server-to-service endpoints authenticated with `X-Service-Key` (the CompanyApp API key), meant for app backends, not end-user SDK clients. The SDK-facing `api/documents/*` routes are unchanged.
- **Per-app document configuration + admin file management** (`{appId}/documents`, `/statistics`, `/files*`) — WildwoodAdmin-portal-only. Uploads through the SDK route are now validated against this config server-side (new 400 messages; images are accepted and stored terminal `parsed`).
- **Admin-only DTO fields not modeled in the SDKs**: `AutoProvisionClientOnRegistration` (auth-configuration DTO — a server-side registration behavior toggle) and `CompanyAIProviderName`/`SystemProviderName` (AI-config DTO — nulled for non-admin callers). All three stacks omit them consistently.
- **Auth-provider list behavior** (7/24–7/26): the server no longer falls back to company-level providers for unconfigured apps and hides credential-less/company-disabled providers — components must tolerate an empty provider list (all three do). Provider buttons render the DTO's `buttonText` when configured (three stacks aligned July 2026).

### Feedback screenshot capture — deliberately stack-specific (2026-08-06)

The FeedbackComponent's screenshot capture is the clearest case in the library of
**the same user-facing guarantee reached by three different mechanisms**. Do not
"fix" one stack into looking like another here; the divergence is the design.

The shared guarantees, which all three stacks now meet:

1. **A strict Content-Security-Policy must not break screenshots.** html2canvas is
   reached from the app's OWN origin, never from a third-party CDN by default.
2. **No permission prompt when a local library can do the job silently.** Both
   capture modes try html2canvas first; `getDisplayMedia` is a last resort, not a
   peer, because it puts a share picker in front of the user.
3. **Report the actual cause.** A typed reason drives per-reason copy instead of
   one generic "Failed to capture screenshot." — and a deliberate cancel (Escape,
   a too-small selection, or dismissing the share picker) produces NO message at
   all. The reason SET is per-stack and deliberately not uniform: JS carries all
   six (`library-blocked`, `library-timeout`, `permission`, `wrong-surface`,
   `unsupported`, `failed`), because only its area capture crops viewport
   coordinates out of a native frame and so has to refuse a foreign surface.
   Blazor documents `wrong-surface` and maps copy for it defensively but never
   raises it; Razor carries five and omits it outright. Neither omission is a gap
   — a path that never crops a shared frame cannot fail that way.

How each stack gets there:

| Stack | Mechanism |
|---|---|
| **JS** (`@wildwood/react`) | `html2canvas` is a package dependency loaded by dynamic `import()`. A bundler resolves it from the app's origin and code-splits it, so an app that never opens the widget never downloads it. The CDN remains for consumers who load the SDK from a CDN and so have no bundler. |
| **.NET** (Blazor + Razor) | No bundler exists to code-split an npm dependency, so `html2canvas.min.js` is **vendored into each package's `wwwroot`** and served as `_content/<package>/js/html2canvas.min.js`. Blazor resolves that sibling URL from `import.meta.url` (ES module); Razor from `document.currentScript` (classic script). Each RCL carries its own copy — the two packages are independent and neither references the other. |
| **Swift** | **No in-SDK capture exists at all**, and none is planned: screenshots arrive from the host app (e.g. `ImageRenderer`) or the photo library. There is no CSP, no third-party script, and no screen-share prompt on iOS, so guarantees 1 and 2 have no counterpart — their absence is NOT a parity gap. Guarantee 3 applies to the path Swift does own: a PhotosPicker load that fails says so, a cancel stays silent, and the image is re-encoded to JPEG under the app's `screenshotQuality`/`screenshotMaxSizeKb` so the `data:image/jpeg` URL is true of its bytes. |

Host escape hatches, identical in all three web stacks: pre-register
`window.html2canvas` (nothing is fetched), or set `window.__WW_HTML2CANVAS_SRC__`
to a URL you serve yourself (used ALONE when set — it does not fall through to the
vendored copy, because naming a URL is a statement about where the library should
come from).

Updating the vendored copy: replace `wwwroot/js/html2canvas.min.js` in BOTH .NET
packages with `node_modules/html2canvas/dist/html2canvas.min.js` from the version
`@wildwood/react` pins, so all three stacks stay on one version (1.4.1 as of this
entry). `.gitattributes` marks `*.min.js` as `-text` so the checked-in dist stays
byte-identical to the upstream release.
