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
WildwoodComponents.Shared          ← .NET shared library: models, DTOs, utilities, machines
  ├─► WildwoodComponents.Blazor    ← Blazor interactive components (53 .razor files)
  ├─► WildwoodComponents.Razor     ← Razor ViewComponents for MVC (34 components)
  └─► WildwoodComponents.WebForms  ← classic WebForms user controls, .NET Framework 4.8
```

Count rules (verified 2026-09-20, so the numbers are reproducible): **Blazor** = `.razor`
files under `WildwoodComponents.Blazor/Components/` (56) minus the three `*Demo.razor`
host samples = **53**. **Razor** = `*ViewComponent.cs` files under
`WildwoodComponents.Razor/Components/` = **34**. **WebForms** = shipped `.ascx` controls = **2**.

**Read the Blazor number the way you read the Swift one below: it is a FILE count, not a count
of user-facing components.** It went 33 → 53 in the September 2026 regsub sync without twenty new
components arriving: the rule counts every `.razor` file, and
`Components/RegistrationSubscription/` alone contributes 19 — four top-level files
(`RegistrationAndSubscriptionComponent` + the three views) and **15 `Parts/*.razor`**
(`PackGrid`, `PackPicker`, `PackCheckout`, `PackCardBody`, `PackOutcomeList`, `PlanGrid`,
`PlanSummaryCard`, `PlanChangeNotice`, `OrderSummary`, `PricingSkeleton`, `TokenPlanSummary`,
`CardSetupForm`, `PaymentModal`, `ClosedNotice`, `CatalogJsonLd`) that are internal pieces of one
component, not components a host mounts. One new user-facing component landed: see the inventory
below (27 → 28).

- **WildwoodComponents.Shared** is the .NET-internal shared library. It holds models (`AppTierModels`, `WildwoodAuthModels`, `PaymentProviderModels`, etc.), utilities (`FormatHelpers`, `TokenExpiryParser`, `SessionConstants`), and is consumed by both Blazor and Razor projects within the .NET solution. Since the September 2026 regsub sync it is also the .NET home of the **cross-stack business rules** ported from `@wildwood/core` + `@wildwood/react-shared`, so Blazor, Razor and WebForms share one copy: `CatalogHelpers` and `FormatHelpers.FormatMoney`/`TrialLabel`, `SignupParams`, `SignupRegistrationMode` (the five-row resolver), `AddOnRowRules`, `AttributionRules`, `SpeechAudioFormats`, `AppTierActionMapper`, `RegistrationSubscriptionLabels` (the 95-string label contract), and `RegistrationSubscription/` — the three pure reducers (`SignupMachine`, `PackCheckoutMachine`, `PlanChangeMachine`) plus `StepToken`. It also hosts the framework-neutral **Seeder** (`Seeder/`) — a server-side app-data provisioning harness (idempotent `ISeederTask`s, `SeederApiClient`, topo-sorting `SeederRunner`, auto-startup `SeederRunnerService`) that any .NET host can adopt. As of July 2026 the seeder authenticates X-API-Key-first (an app API key minted with the `tiers:manage` scope); CompanyAdmin login and pre-issued bearer tokens are deprecated fallbacks.
- **WildwoodComponents.Blazor** has its own services layer, base component class (`BaseWildwoodComponent`), JS interop scripts, and payment script providers.
- **WildwoodComponents.Razor** has its own services layer (server-side HTTP calls), ViewComponent classes, Razor views, cookie auth helpers, and middleware. It also **ships four same-origin proxy controllers** that hosts do not write: `WildwoodNotificationsProxyController` (`api/wildwood-notifications`), `WildwoodAttributionProxyController` (`api/wildwood-attribution`), `WildwoodRegistrationSubscriptionProxyController` (`api/wildwood-regsub`, September 2026) and `WildwoodSpeechProxyController` (`api/wildwood-stt`, September 2026). A host must therefore call `builder.Services.AddControllers()` and `app.MapControllers()` or the browser half of those components 404s. Proxy route templates must avoid any segment that is also a WildwoodAPI controller root (`disclaimers`, `payment`, `auth`, …) unless they really forward that API path: `scripts/parity-check.mjs` extracts quoted literals from every `.cs` file and would read the template as a .NET-only endpoint. That is why the disclaimer gate's routes are `disclaimer-gate/pending|accept` and not `disclaimers/…` (the real API path is `disclaimeracceptance/…`).
- **WildwoodComponents.WebForms** (August 2026) targets **.NET Framework 4.8** — WebForms was never carried forward past it, and 4.8 is the last universal release (installs back to Windows 7 SP1 / Server 2008 R2 SP1, in-place upgrade from 4.5–4.7.2; 4.6.2–4.7.2 leave support 2027-01-12 and 4.8.1 is Windows 11 / Server 2022+ only). It consumes `WildwoodComponents.Shared` through a new `netstandard2.0` leg (the Seeder is excluded from it). Delivery is a compiled DLL plus **NuGet content**: `.ascx` user controls and `.ashx` proxy handlers whose `Inherits=`/`Class=` name compiled base classes, so consumers build nothing. See the `### WebForms rules (net48)` section in the .Net repo's CLAUDE.md before touching it — all six rules there are load-bearing: (1) `.ascx` markup carries `Inherits=` and never a `CodeFile`; (2) never render a nested `<form>`; (3) never fork the Razor `wwwroot` assets (the csproj packs them from one source of truth); (4) bearer tokens go on the request, never on the process-wide shared client; (5) **write endpoint paths as interpolated strings** — `scripts/parity-check.mjs` extracts them, and a concatenated id produces a false one-sided entry; (6) `netstandard2.0` has no `[NotNullWhen]` on `string.IsNullOrEmpty`, so use pattern form. **Phase A only** so far: Authentication and TwoFactorSettings.
- **Test Suite**: `WildwoodComponentsTestSuiteBlazor` — Blazor web app with **26** pages (24 component test pages, plus Home and Login; count rule, verified 2026-09-20: unique `@page` routes under the test-suite project).

### JS Architecture (WildwoodComponents.JS)

Self-contained pnpm monorepo with its own internal shared library:

```
@wildwood/core                   ← JS shared library: services, types, utilities (framework-agnostic TS)
  ├─► @wildwood/react-shared     ← Shared React hooks + flows/machines (business logic, no UI)
  │     ├─► @wildwood/react      ← React components + hooks (49 components, 30 hooks)
  │     └─► @wildwood/react-native ← React Native components (46 components, 31 hooks)
  └─► @wildwood/node             ← Node.js/Express middleware + admin client
```

Count rules (verified 2026-09-20): components = distinct **value** exports re-exported from
`./components/` in each package's `src/index.ts`; hooks = distinct `use*` value exports from
`./hooks/`. Type-only exports (`export type { … }` and inline `type X` specifiers) are not
counted. Two consequences worth stating, because both numbers moved a lot in the September 2026
regsub sync:

- The React and RN component counts include **internal parts re-exported for host composition**,
  not only mountable components: the shared sub-components the rule already covered (`TierCard*`,
  the six admin panels, `LoadingSpinner`, `ErrorBoundary`, `ProtectedRoute`) and now the regsub
  parts (`ClosedNotice`, `PaymentModal`, RN's `PlanChangeNotice`, `CancelResultNotice`). React's
  49 also includes **three non-component values that happen to live under `./components/`** —
  `DEFAULT_REGISTRATION_SUBSCRIPTION_LABELS`, `formatRegistrationSubscriptionLabel` and the
  `usePlanChangeFlow` re-export. The rule is mechanical on purpose; do not read 39 → 49 as ten new
  screens.
- The counts move together with `@wildwood/react-shared`: the hook count there is the one that
  tracks genuinely shared logic.

- **@wildwood/core** is the JS-internal shared library. Pure TypeScript, zero UI dependencies. Contains `AuthService`, `AIService`, `MessagingService`, `PaymentService`, `TwoFactorService`, `CaptchaService`, `AppTierService`, `DisclaimerService`, `NotificationService`, `ThemeService`, `WildwoodEventEmitter`, `WildwoodClient`, and all shared types. Consumed by all other JS packages.
- **@wildwood/react-shared** holds **32** hooks with pure business logic (no UI) shared between React web and React Native (count rule, verified 2026-09-20: distinct `use*` value exports from `./hooks/` in `packages/wildwood-react-shared/src/index.ts` — two of them, `useAuthenticationLogic` and `useTwoFactorLogic`, are consumed by the UI packages rather than re-exported from them). **What the rule EXCLUDES**: the September 2026 sync added the registration/subscription flow hooks under `./registrationSubscription/`, not `./hooks/` — `useSignupFlow`, `usePlanChangeFlow`, `usePackCheckoutFlow` — so the package's total `use*` value exports are **35** while the stated `./hooks/` rule reports 32. Alongside them the same directory holds the DOM-free regsub pieces both UI packages share: `labels.ts` (the 95-string default label set + `resolveLabels`), `types.ts`, `stepTokens.ts`, the three machines (`signupMachine`, `packCheckoutMachine`, `planChangeMachine`) and `paymentActions.ts` — the `PaymentActionAdapter` seam the flows are injected with, so react-shared stays DOM-free and Stripe-free while React supplies a Stripe.js-backed adapter and native hosts supply their own (or none).
- **@wildwood/react** wraps core services with React components and re-exports shared hooks.
- **@wildwood/react-native** provides native mobile components using the same shared hooks.
- **@wildwood/node** provides Express middleware (`authMiddleware`, `rateLimitMiddleware`, `proxyMiddleware`), `adminClient` for server-to-server operations, and the **Seeder** (`seeder/` — `SeederRunner`/`runSeeder`, the server-side app-data seeding harness ported from .NET `WildwoodComponents.Shared/Seeder`). The Seeder is server-only (CompanyAdmin login + startup seeding) and so has no `@wildwood/core`, react, react-native, or Swift counterpart — the same reason `@wildwood/node` itself has no Swift equivalent.
- **Test Suite**: `WildwoodComponentsTestSuite.React` — Vite + React app with **21** test pages (count rule, verified 2026-09-20: `path=` routes in `WildwoodComponentsTestSuite.React/src/App.tsx`).

### Swift Architecture (WildwoodComponents.Swift)

Self-contained SPM package (two products) with its own internal shared library:

```
WildwoodCore                     ← Swift shared library: services, models, session/token mgmt (zero UI imports)
  └─► WildwoodSwiftUI            ← SwiftUI components (46 .swift files) + @Observable view models
        ├─ ViewModels/           ← ≈ @wildwood/react-shared (no `import SwiftUI`)
        └─ Components/           ← ≈ @wildwood/react-native (iOS-gated)
```

Count rule (verified 2026-09-20): `.swift` files under `Sources/WildwoodSwiftUI/Components/`,
**support types and internal sub-views included** — `CaptchaWebView`, `StoreKitPurchaseManager`,
`StorePurchaseSettlement`, `TierCard`, `SubscriptionPanels`, `UsageMath`, and (since September
2026) 12 of the 16 files in `Components/RegistrationSubscription/` — everything except
`RegistrationAndSubscriptionComponent` and the three `RegistrationSubscription*View` files, i.e.
the internal parts those views compose (`ClosedNoticeView`, `OrderSummaryView`,
`PackCheckoutView`, `PackGridView`, `PackOutcomeListView`, `PackPickerView`, `PaymentSheetView`,
`PlanChangeNoticeView`, `PlanGridView`, `PlanSummaryCardView`, `PricingSkeletonView`,
`TokenPlanSummaryView`) — are files under `Components/` but are not user-facing components. So
this number is not comparable one-for-one with the JS export counts above, and 29 → 46 is not
seventeen new components.

- **WildwoodCore** mirrors `@wildwood/core` method-for-method: `WildwoodClient` factory exposing `auth`, `session`, `ai`, `messaging`, `payment`, `appTier`, `twoFactor`, `captcha`, `disclaimer`, `feedback`, `notifications`, `consent`, `attribution`, `features`, `theme`, `events`, `http` — and, since September 2026, `catalog` (a `PublicCatalogStore` with the same 60 s cache / failures-never-cached / invalidate rule as `usePublicCatalog`) and a settable `paymentActionHandler` (the `WildwoodPaymentActionHandler` seam; see `Payment/PaymentActionHandler.swift`). `AIService` gained `transcribeAudio` (`POST api/stt/transcribe`). Swift 6 strict concurrency: `WildwoodHttpClient` is an actor; `SessionManager`/`NotificationService`/`ThemeService` are `@MainActor @Observable`. Tokens go to the Keychain, other `ww_` keys to UserDefaults (CompositeStorage).
- **Payments are processor-agnostic**: provider selection is backend-driven via `PlatformFilteredProvidersDto`; the App Store path runs StoreKit 2 and validates JWS against `api/payment/validate-apple-receipt`, others use generic `initiatePayment`/`confirmPayment` with web checkout — all payment/subscription state remains in Wildwood.
- **Test Suite**: `WildwoodComponentsTestSuite.iOS` — XcodeGen-defined SwiftUI app with **21** test screens (count rule, verified 2026-09-20: `case`s of the `TestScreen` enum in `TestSuite/HomeScreen.swift`; `project.yml` checked in, `.xcodeproj` generated on a Mac).
- iOS 26 minimum deployment; iOS 27 features behind `@available(iOS 27, *)`. Builds/tests require macOS (Xcode 27 beta); code can be authored on Windows.

### Shared Library Equivalence

Each project has its own shared library serving the same purpose within its tech stack:

| .NET (internal) | JS (internal) | Swift (internal) | Purpose |
|------|----|----|---------|
| `WildwoodComponents.Shared` | `@wildwood/core` | `WildwoodCore` | Shared models, types, utilities for the project |
| Blazor services + `WildwoodComponents.Shared/RegistrationSubscription` | `@wildwood/react-shared` | `WildwoodSwiftUI/ViewModels` | Shared business logic between component sets |
| `WildwoodComponents.Blazor` | `@wildwood/react` | `WildwoodSwiftUI` | Interactive components |
| `WildwoodComponents.Razor` | `@wildwood/react-native` | (single UI framework) | Alternative platform components |
| `WildwoodComponents.WebForms` | (no equivalent) | (no equivalent) | Legacy-host components (.NET Framework 4.8) |
| (no equivalent) | `@wildwood/node` | (no equivalent) | Server-side SDK |

## Component Inventory (28 components at parity)

All three stacks implement these components:
- **AI**: AIChatComponent, AIProxyComponent (all three stacks ship one, but the shapes differ: React/RN and Blazor/Razor each give it its own file and UI, while Swift's is a thin `View` wrapper over `AIChatComponent(useProxy: true)` declared inside `Components/AI/AIChatComponent.swift`. The `api/ai/proxy` call itself lives in `WildwoodCore`'s `AIService`, so the wrapper is a packaging choice, not a missing component), AIFlowComponent (July 2026 — app-facing "AI Flows with LangChain": SSE-streamed runs of published LangGraph flows with human-in-the-loop interrupts and run history; a NEW feature, unrelated to the obsolete AIFlow deleted May 2026)
- **Auth**: AuthenticationComponent, TokenRegistrationComponent, SignupWithSubscriptionComponent
- **Subscriptions**: SubscriptionAdminComponent (+ 6 admin sub-panels: StatusPanel, TierPlansPanel, FeaturesPanel, AddOnsPanel, UsageLimitsPanel, OverridesPanel) — tier-based; the legacy SubscriptionComponent/SubscriptionManagerComponent were removed June 2026 (they targeted a nonexistent `api/subscription/*` backend)
- **Payment**: PaymentComponent, PaymentFormComponent
- **Pricing/Tiers**: PricingDisplayComponent, AppTierComponent
- **Registration & Subscription**: RegistrationAndSubscriptionComponent (September 2026 — one entry point over three views, `pricing` / `signup` / `manage`, in every stack: React and RN ship `RegistrationAndSubscriptionComponent` + `RegistrationSubscription{Pricing,Signup,Manage}` with the flows, labels and machines shared through `@wildwood/react-shared`; Blazor ships the component, the three views and `Components/RegistrationSubscription/Parts/`, with drivers over the `WildwoodComponents.Shared` machines; Razor ships `<vc:registration-and-subscription view="…">` plus three ViewComponents, with the machines ported to `wwwroot/js/regsub-machines.js` and a library-shipped same-origin proxy at `api/wildwood-regsub`; Swift ships `RegistrationAndSubscriptionComponent` + `RegistrationSubscription{Pricing,Signup,Manage}View` with `@MainActor @Observable` flow models over the value-type machines.) **Campaign Attribution is NOT counted here**: it is a service plus a hook/drop-in (`AttributionService` + `useAttribution`, Blazor/Razor engines, `WildwoodCore.AttributionService`), recorded in the docs but not a UI component — the same rule the Seeder falls under. `SignupWithSubscriptionComponent`, `AppTierComponent` and `PricingDisplayComponent` are **deprecated in every stack** as of this sync (`@deprecated` JSDoc, `[Obsolete]`, `@available(*, deprecated)`), pointing at the new views; they still ship, still work and still count.
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

Two more extractor rules that cost a stage each to learn, so do not relearn them:

- **A Razor proxy's route template is a quoted literal in a `.cs` file, and the extractor cannot
  tell it from an API call.** Never root a proxy route at a segment in `KNOWN_ROOTS` unless the
  route really forwards that API path. The disclaimer gate is `disclaimer-gate/pending|accept`
  for exactly this reason (its API path is `disclaimeracceptance/…`). The fix for such a
  collision is renaming the route, **not** adding the string to `KNOWN_BENIGN_ONE_SIDED` — that
  would mask a real future divergence on the colliding root.
- **Comments count.** The regex reads any double-quoted literal in the file, prose included, so a
  comment that quotes an endpoint-shaped string extracts as an endpoint.

`KNOWN_ROOTS` gained `stt`, `consent` and `attribution` on 2026-09-20. A root is only worth
adding when every stack extracts the same paths under it, or the difference is an extraction
artifact verified by reading the services — see documented case 5 in the script for why
`attribution/config` and `attribution/touch` are one-sided (.NET's attribution engine is
browser-side, in `wwwroot/js`, outside the `.cs`-only walker) while `attribution/claim` is
checked 3-way.

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

### September 2026 parity sync (2026-09-07)

A cross-stack sweep that closed the gaps below and, more importantly, wrote down the
backend facts and the deliberate divergences so later audits do not re-chase them.
Full audit: `Plan/20260907-0836-cross-stack-parity-sync/plan.md`.

**What was synced**

| Stack | Changes |
|---|---|
| **JS** | core `validateStorePurchase` also sends `receiptData`; React `AppTierComponent` previews paid changes and forwards `paymentTransactionId` after payment; RN gained `onRegisterClick`. |
| **.NET** | forced-reset flag preserved across refresh in Blazor/Razor/WebForms; Blazor sends a per-request bearer on reset; `ResetToken` wire parity; Blazor `AllowRegistration`/`OnRegisterClick`; Razor `registerUrl` + WebForms `RegisterUrl`; password visibility toggles in Razor/WebForms; Shared `StorePurchase` + Blazor `ValidateStorePurchaseAsync` (old method `[Obsolete]`); `SubscriptionOverride` on both usage dashboards; four Razor CSS fallbacks. |
| **Swift** | `validateStorePurchase` + IAP models; StoreKit finish rule (`StorePurchaseSettlement`); ThemeService→environment bridge with explicit-theme precedence; `PricingDisplayComponent` moved to `getPublicTiers`; `allowRegistration`/`onRegisterClick`; `WildwoodSecureField`; `UsageDashboardComponent` two-arg `onMergeUsage` + overrides; `AuthView: Equatable`. |

**Backend facts that bound the sync** — state them, do not re-derive them:

1. WildwoodAPI's `ValidateReceiptRequest` binds `receiptData`, **not**
   `purchaseToken`/`transactionId`/`isRestore`. All three stacks therefore send
   `receiptData` (= the purchase token) alongside `purchaseToken`. The follow-up
   belongs in WildwoodAPI — bind `PurchaseToken` as a fallback and add
   `TransactionId`/`IsRestore` — not in the SDKs.
2. `POST api/auth/reset-password` is `[Authorize]` and its DTO carries no
   `ResetToken`. The `resetToken` field JS, Swift and .NET all carry is **wire parity
   for a future emailed-link flow** and 401s today. Do not "fix" it by removing it.
3. `disclaimeracceptance/pending/{appId}` is `[AllowAnonymous]`, so Blazor's
   unauthenticated pending fetch is correct as written.

**Decisions — idioms, not gaps**

- Razor `AllowRegistration` / WebForms `AllowRegistration` stay **AND-only**: a
  server-rendered stack can hide sign-up but cannot force-show it.
- Razor `registerUrl` and WebForms `RegisterUrl` are the server-rendered analog of
  React/RN/Blazor's `onRegisterClick` callback — a URL, not a delegate.
- Swift `subscriptionOverride` is a plain optional. React's explicit-null-hides-the-badge
  tri-state is modelled in **neither** Swift nor .NET, and that is intentional.
- The Swift theme bridge applies `.tint(accent)` at the root, exactly as
  `.wildwoodTheme(_:)` always did; the bridge only changes where the theme comes from.
- StoreKit transactions are finished **only** after a validation that returned a Wildwood
  transaction id (for restores, success alone suffices) — the same rule RN's
  `useInAppPurchases` follows.
- Swift `UsageLimitRow`'s new members default to `80` / `true` so the admin usage panel
  and the dashboard share one warn-threshold rule.

**Deferred — known divergences; do not flag these as regressions**

- **Theme depth.** Swift's `WildwoodTheme` has 7 fields (`name` + 6 colors) against the
  web's 64 `--ww-*` CSS custom properties and RN's 52-field `WildwoodTheme`. Both are
  shallow on purpose — iOS defers chrome to the system. *Re-measured 2026-09-20* (count
  rule: source files that name `wildwoodTheme`/`WildwoodTheme` or call `useTheme`): Swift
  **19 of 46** files under `Sources/WildwoodSwiftUI/Components/`, RN **5 of 66** files
  under `src/components/` (`AppTierComponent`, `AuthenticationComponent`,
  `DisclaimerComponent`, `InAppPurchaseSheet`, `UsageDashboardComponent`). Swift's share
  rose because the new `RegistrationSubscription/` views all take the theme from the
  environment bridge; RN's absolute count did not move.
- **`AppTierComponent` payment-collection shape differs by stack**: RN exposes an
  `onPaymentRequired` callback seam, React/Blazor run an internal payment step, Swift
  raises `onTierChangeRequested`. `SubscriptionAdminComponent` carries the callback seam
  in all stacks, so the seam exists everywhere — just not on the same component.
- React `AppTierComponent.showAddOns` is declared but never renders anything.
- ~~`getPublicAddOns` has **zero component callers in every stack** — method-level parity only.~~
  **No longer true as of 2026-09-20.** The public-catalog load the Registration & Subscription
  pricing view runs fetches tiers and add-ons together, so `getPublicAddOns` now has real callers
  in every stack: `usePublicCatalog` (JS react-shared), `AppTierComponentService.Checkout`
  (Blazor) and `WildwoodAppTierService.Checkout` (Razor), and `PublicCatalogStore` (Swift).
- Razor `WildwoodAuthService` lacks passkeys, `validateLicenseToken`, `sendTwoFactorCode`
  and `verifyTwoFactorRecoveryCode`; Razor `WildwoodPaymentService` lacks
  `RequestRefundAsync` and `ValidateAppStoreReceiptAsync`. Server-rendered platform limits.
- Blazor calls `userregistration/register|validate` inline from components rather than
  through a service. Still true of `TokenRegistrationComponent.razor`; the new
  `RegistrationSubscriptionSignup` goes through `Services/SignupAccountCreator.cs` instead, so
  this is now a single-component holdout rather than the Blazor idiom.
- Razor's `ApplyAuthorizationHeader` mutates the shared client's default headers. A
  Razor-wide per-request-token refactor is a separate effort (WebForms rule 4 already
  forbids copying the pattern).

**Corrected during this run**: the audit's note that "Swift has no `AIProxyComponent`
view" is **wrong** — `public struct AIProxyComponent: View` exists in
`Sources/WildwoodSwiftUI/Components/AI/AIChatComponent.swift`. See the AI line in the
Component Inventory above.

### September 2026 Registration & Subscription parity sync (2026-09-20)

The Registration & Subscription component shipped React-only in JS (`main` 7a3fe85). This sync
ported it to React Native, Blazor, Razor and Swift, closed the Campaign Attribution gaps left in
.NET and Swift, and gave speech-to-text method-level parity in all three stacks. Full audit and
the three delta appendices: `Plan/20260918-1238-regsub-cross-stack-parity/plan.md`.

**What was synced**

| Stack | Changes |
|---|---|
| **JS (core + react-shared + React)** | `AIService.transcribeAudio` + `useAI`; React `AIChatComponent` voice input made real (native `SpeechRecognition` → `MediaRecorder` fallback, 60 s / 25 MB caps); the DOM-free regsub pieces LIFTED into `@wildwood/react-shared` (`labels.ts`, `types.ts`, `stepTokens.ts`, the three machines, `useSignupFlow`/`usePlanChangeFlow`/`usePackCheckoutFlow`) behind a `PaymentActionAdapter`, with React's Stripe.js adapter supplied by React so its public exports and behaviour are unchanged; the `paymentOrder` machine option. |
| **JS (React Native)** | The whole component: `RegistrationAndSubscriptionComponent` + pricing/signup/manage views + parts, on the shared flows; `paymentActionHandler` prop; `PaymentComponent` `pricingModelId`/`trialDays`/SetupIntent/trial-unavailable/intent reuse/single success; `AddOnsPanel`, `FeaturesPanel`, `SubscriptionAdminComponent` brought to React's rewritten behaviour; `formatMoney` everywhere; `paymentSeam` fixes; deprecation notes; new exports. RN's test count went 78 → 471. |
| **.NET Blazor** | `PaymentComponent` split into code-behind + Stripe partial, then the five fixes (SetupIntent card-save for a free trial, server-recorded transaction id, same-intent retry, trial-unavailable gate, single `OnPaymentSuccess` + `OnContinue`, validated `BillingAddress`); nine new app-tier service methods + the structured error mapper; `Components/RegistrationSubscription/` (component, three views, 15 `Parts/`), `IPublicCatalogService`, `PreloadedCatalog`, JSON-LD; `AddOnsPanel` rewrite; `FormatMoney` everywhere; entitlement invalidation with the six-member reason vocabulary; attribution auto-attach/clear/claim-queue; new test-suite page. |
| **.NET Razor** | The same service surface as parity placeholders + a **library-shipped** `WildwoodRegistrationSubscriptionProxyController` (`api/wildwood-regsub`) and `WildwoodSpeechProxyController` (`api/wildwood-stt`); the machines ported to `wwwroot/js/regsub-machines.js`; pricing / signup (pay-first) / manage ViewComponents + `<vc:registration-and-subscription>`; `payment.js` five fixes; `AddOnsPanel`; `TranscribeAudioAsync` + recorder fallback + the `ai-chat.js:359` precedence bug; the disclaimer-gate proxy routes renamed off the `disclaimers` root. |
| **.NET WebForms** | Attribution only (Phase A is unchanged): registration now carries the captured payload, under the six WebForms rules. net48 tests 114 → 135. |
| **Swift** | `WildwoodError.fromResponse` reads `errorMessage`; all new models; ten `AppTierService` methods + `changeTier(options:)`; `entitlementsChanged`/`attributionCaptured` events; attribution completion (A1–A8); existing-component fixes; catalog helpers + `PublicCatalogStore` on the client; `SignupRegistrationMode` + `StepToken` + the three value-type machines; `WildwoodPaymentActionHandler` + the three `@Observable` driver models; the component + three views + 12 parts; `RegistrationSubscriptionLabels`; `AIService.transcribeAudio`; two new `TestScreen` cases. |
| **Sync** | `scripts/parity-check.mjs`: `stt`, `consent` and `attribution` added to `KNOWN_ROOTS`; `attribution/config`/`attribution/touch` recorded as documented-benign case 5. This CLAUDE.md: every count re-measured, inventory 27 → 28, this section. |

**Backend facts that bound the sync** — state them, do not re-derive them:

1. **Stripe `POST api/payment/initiate` never returns a hosted checkout URL.** Only PayPal does.
   A Stripe plan payment is confirmed client-side against the returned client secret; a stack that
   waits for a redirect URL will wait forever.
2. **`GET api/payment/status/{id}` is a stub that always reports completed.** Never poll it to
   decide anything. Re-check a payment with `confirmPayment` instead.
3. **`InitiatePaymentRequest` has no billing-address property.** The `BillingAddress` object every
   stack now sends is accepted and **ignored server-side**. It is sent for wire parity and for the
   day the API binds it; do not "fix" it by deleting the field, and do not promise hosts that it
   is stored.
4. **The tier-change route refuses an unpaid change with an UNCODED `BadRequest`.** Razor's
   `ww-regsub-payment-required` event keys off the `PaymentMethodRequired` error code, so it
   **cannot fire today**. The follow-up belongs in WildwoodAPI (return the code), not in Razor.
5. **The platform cancels orphaned add-on checkout transactions at Stripe after 24 h, and its
   webhook reconciles invoices that were in fact paid.** That is why every driver's teardown is
   "**detach, then drain**" — stop delivering results to a view that is going away, but let the
   in-flight completion finish — rather than an abort: a checkout abandoned mid-3DS cannot strand
   money in either direction.
6. **`requiresAction` and `processing` arrive with `success:false` and are NOT failures.** They
   are "the customer has one more step" and "the server is still working". Treating either as a
   failure is the single easiest way to double-charge somebody.
7. **A bare 404 on one of the new endpoints means `NotSupported`**, i.e. the server is older than
   the SDK — not "the thing you asked about does not exist". All stacks map it that way.

**Decisions — idioms, not gaps**

- **The reference is React web + `@wildwood/core` + `@wildwood/react-shared` at JS 7a3fe85**, and
  the wire contracts are byte-exact across stacks: PascalCase request bodies, the `BillingAddress`
  key, `?immediate=<bool>` on add-on cancel, `SupportsPaymentAction` sent **only** by the options
  form of `changeTier`, query keys `tier`/`pricing`/`addons` (+ `token`/`invite`/`email`), pack
  selection capped at 25, the `trialLabel` wording, the error codes.
- **Web-only pieces were not ported literally**: Stripe.js/Elements (`payment/stripe.ts`,
  `useStripeCardElement`, `CardSetupForm`), `initialCatalog`/SSR seeding, Storybook, Playwright —
  and, from the addendum below, the `@wildwood/react/testing` entry point (Playwright helpers that
  drive the signup, importing Playwright for **types only**, with `@playwright/test` pinned
  **exactly** at 1.61.1 in both the devDependency and the optional peer). That is web test tooling
  with no counterpart in any other stack, and the exact pin is a JS packaging fact — not a
  cross-stack contract. Blazor and Razor reach Stripe through their existing script interop.
- **Native stacks (React Native, Swift) take NO Stripe SDK dependency.** A card sheet and a bank's
  3-D Secure challenge need a native module and merchant configuration, so the one thing the flows
  cannot do for themselves is **injected**: a host-supplied payment-action handler with
  `confirmPayment(clientSecret, publishableKey?)` and `confirmCardSetup(...)`, each resolving to
  `succeeded | failed(message) | cancelled` — the same idiom as RN `captureScreenshot` and
  `onProviderSignIn`. **Without a handler** (a supported, default state) the native stack: never
  sends `SupportsPaymentAction: true`, never sends `supportsSetupIntent`, never calls
  `createCheckoutPaymentMethod`, offers in-app pack purchase only when the quote says
  `requiresPaymentMethod == false` (saved card → `UseSavedCard: true`), and reports a
  `requires_action` answer as **not completed** with "finish this purchase on the web" copy —
  never a silent failure, never a throw. The machines do not branch for this: `authenticating`
  resolves to the failed event when no handler exists.
- **Signup order differs by platform and the machines carry the option, not the stacks.** Web
  (React, Blazor, Razor) is **pay-first**, as React ships. Native (RN, Swift) defaults to
  **account-first**, because a StoreKit/Play purchase that succeeds before a registration that
  then fails strands a paid store subscription with no account. One machine option,
  `paymentOrder: beforeAccount | afterAccount`, expresses it, and it is present in **all four
  machine ports** (TS, C#, Razor JS, Swift) so the ports stay table-identical and the JS machine
  tests port unchanged. Packs are bought after login in every stack.
- **App-Store-exclusive apps (`requiresAppStorePayment`) hide pack PURCHASE on Swift and RN.**
  There is no IAP product mapping for add-ons and pack checkout is Stripe-only. Owned, bundled and
  complimentary rows still render; plan-change proration copy is replaced by an "Apple manages
  billing for this change" notice.
- **Razor's interaction contract is events + URL parameters + the shipped proxy**, not callbacks:
  every `on*` prop is a bubbling `CustomEvent` (`ww-regsub-select`, `ww-regsub-signup-complete`,
  `ww-regsub-entitlements-changed`, `ww-regsub-error`, …), every markup callback is a string
  parameter or the built-in notice, and the library ships the proxy controller rather than letting
  a host-supplied one break every consumer silently. Three further Razor rules, all deliberate:
  the tier change has **no payment-COLLECTION step** (standing decision) but it **does** complete a
  parked 3-D Secure change for a card already on file, since that needs no card form; picking a
  **different paid plan navigates** (a server re-render) because the browser never formats money;
  and refresh after a change is a reload, not a client-side patch.
- **WebForms stays Phase A** (Authentication + TwoFactorSettings). Its only work here was carrying
  attribution through registration.
- **Blazor's `PreloadedCatalog` parameter and Razor's server-rendered first-paint pricing are the
  `initialCatalog` analogs** — the same "no numbers appear late" guarantee reached the way each
  stack can reach it.
- **JSON-LD is web and Razor only.** React emits `CatalogJsonLd`, Blazor emits it from
  `Parts/CatalogJsonLd.razor`, Razor emits it server-side; RN and Swift have no document head.
- **Only a consent BAR reserves page space — the .NET corner card deliberately does not.** React's
  banner has one position, so its `reserveSpace` effect always pads the page's bottom. The Blazor
  and Razor banner has three (`topBar`, `bottomBar`, `corner`), and `reservedEdge()` returns an
  edge for the two **bars** only: a ~420px card inset from a corner would otherwise leave a
  full-width blank strip under the content for as long as it is up — a worse bug than the one the
  port fixes. The corner card still publishes `--ww-consent-height`, so a host that wants to make
  room itself can.
- **The label set is a 95-string cross-stack contract**, pinned by a test in each stack (JS
  `labels.ts`, .NET `RegistrationSubscriptionLabelsTests`, Swift
  `RegistrationSubscriptionLabelsTests` asserts `table.count == 95`). A string added in one stack
  and not the others fails a test rather than drifting.
- **The three machines are table-identical in all four ports** (TS, C#, Razor JS, Swift) and the
  JS machine tests were ported case for case — the same 19/20/7/10 transition cases across the
  signup, pack-checkout and plan-change machines and the step tokens, verified by diffing the
  reducers line by line against the TS in both the C# and Swift stages. An ignored stale event
  returns the SAME state instance in every port.
- **Every driver tears down "detach, then drain"** (see backend fact 5).
- **The nine app-tier actions answer with structured refusals instead of throwing**
  (`{success:false, errorCode, errorMessage}` shaped like the success DTO, because the checkout
  endpoints answer refusals with the same DTO). Swift's versions are `async throws` **only** so
  cancellation can propagate — a refusal is still a returned value, not an error.
- **Speech-to-text is method-level parity everywhere** (`transcribeAudio` in core + `useAI`, Razor
  `TranscribeAudioAsync` + recorder fallback + proxied route, Swift `AIService.transcribeAudio`),
  and React web gained **working** voice input (its `enableSpeechToText` prop was a dead stub).
- **Deprecations mirror JS 541e446**: `SignupWithSubscriptionComponent`, `AppTierComponent` and
  `PricingDisplayComponent` are deprecated in every stack, pointing at the new views. They keep
  working, and `AppTierComponent`'s one-time-charge behaviour is left exactly as JS left it.

**Deferred — known divergences; do not flag these as regressions**

- **RN and SwiftUI have no AI-chat voice UI.** Native audio capture needs host permission strings
  and (RN) a native module. Both stacks have `transcribeAudio`; only the UI is missing.
- **Swift and RN without a payment-action handler** can offer packs only on a saved card and must
  finish a `requires_action` purchase on the web (the exact rule is in Decision 3 above). That is
  the designed no-handler state, not an unfinished path.
- **The Swift pricing view omits React's `loadingFallback`/`errorFallback` slots** (they would
  force generic parameters onto the view) and drives App-Store hiding through a host-set
  `packPurchaseAvailable` flag rather than reading platform info itself.
- **Swift and RN accept `requireBillingAddress` but do not collect an address.** The flag is
  carried for API parity; see backend fact 3 for why nothing is lost today.
- **Swift's `onDisappear` detach is terminal.** Safe for everything the signup/manage views host
  today, but a host that pushes navigation OVER the view mid-flow returns to a dead flow. Do not
  push over it; the Swift README says so.
- **Razor has no JS test harness.** `wwwroot/js` changes are validated by `node --check` plus the
  Node self-tests (`WildwoodComponents.Tests/Razor/js/*.selftest.mjs`, 209 checks for the
  machines, 77 for ai-chat) and by keeping the logic in pure functions. Nothing renders in a
  browser in CI.
- **`<vc:subscription-admin>` now REQUIRES `regsub-machines.js` + `regsub-planchange.js`.** An
  upgraded host without those script tags gets a "missing scripts" message on plan clicks. This is
  a documented behaviour change, not a bug.
- **Razor's legacy `ApplyAuthorizationHeader` still mutates the shared client's default headers**
  and now shares that client with the new per-request-bearer code, so a lingering default header
  could in principle ride an anonymous catalog call. Pre-existing; the Razor-wide per-request-token
  refactor is a separate effort (WebForms rule 4 already forbids copying the pattern).
- **React `AppTierComponent`'s one-time-charge behaviour is unchanged**, and React
  `AppTierComponent.showAddOns` still renders nothing (carried from the 2026-09-07 list).
- **Subscription cancel is not guarded against an in-flight plan change** (3DS / completion
  retries) — the same in React and in Blazor. An upstream follow-up, not a port defect.
- **The FeaturesPanel "Included" badge only lights for admins**, because overrides load only when
  `IsAdmin` — the same in JS `useSubscriptionAdmin`'s self branch.
- **Blazor `AddOnsPanel`'s single `_busyRowId` guard silently no-ops clicks on other rows** while
  one action is in flight, and **Blazor `AllowReactivate` defaults true even in company/user
  scope** while Razor gates it off. Both are behaviour worth an API-authorisation check, not
  parity gaps.
- **Blazor `PaymentComponent` hazards 6–9 from the stage-10 split remain** (unused `_cardComplete`,
  an app-store purchase with an empty receipt exiting silently, `IAsyncDisposable` skipping
  `BaseWildwoodComponent.Dispose()` so `ThemeChanged` is never unsubscribed, `PreloadedProviders`
  aliased rather than copied). Recorded so the next audit does not re-discover them as new.
- **Razor's token-registration inline payment div lacks the id `wwPayment` looks up**, so that
  embedded path never initialises. Pre-existing and untouched by this run.
- **Swift's pack cancel cannot surface store-billing instructions**:
  `AddOnSubscriptionCancelResultModel` has no `requiresUserAction` field — as in JS.
- **The plugin/global CLAUDE.md component tables (`WildwoodComponents.Claude`) were NOT updated by
  this run — FOLLOW-UP.** Their component table still lists the pre-sync set and has no
  Registration & Subscription row.

**Addendum — JS `main` moved during the run (7a3fe85 → 642f719)**

Three PRs landed on JS `main` while this sync was being written: **#29** (`planDefault`), **#30**
(the Playwright testing helpers, the disclaimer action hooks, the consent-banner reserve-space fix)
and **#31** (the exact `@playwright/test` pin). Merge `e27ab3b` brought all three onto the branch.
Exactly one piece needed re-applying: main's `planDefault`/`defaultTierId` edit targeted React's
`components/registrationSubscription/views/useSignupFlow.ts`, which this run had already reduced to
a re-export shim over `@wildwood/react-shared`, so it was **re-applied in react-shared**
(`registrationSubscription/useSignupFlow.ts`; `SignupPlanDefault` in its `types.ts`) — which lands
it in React and React Native at once, and React Native additionally gained the prop and a pure
`signupHighlightTierId` rule. Everything else from main merged unchanged.

**`planDefault: 'none' | 'free'` is now in every stack.**

| Stack | Shape |
|---|---|
| **React + RN** | `planDefault` prop → shared `useSignupFlow` returns `defaultTierId`; RN's precedence is the pure `signupHighlightTierId(selection, default, preSelected)` in `views/signupViewModel.ts` |
| **Blazor** | `PlanDefault` parameter on `RegistrationSubscriptionSignup` **and** on the `RegistrationAndSubscriptionComponent` shell; `SignupViewDecisions.DefaultTierId`/`HighlightTierId`; surfaced as `SignupFlowDriver.DefaultTierId` |
| **Razor** | `plan-default` tag-helper attribute on `<vc:registration-subscription-signup>` and `<vc:registration-and-subscription>`, parsed by `RegistrationSubscriptionSignupDecisions.ParsePlanDefault` and decided **server-side** — no client JS and no data attribute |
| **Swift** | `planDefault:` on `RegistrationSubscriptionSignupView` and `RegistrationSubscriptionSignupConfiguration`; rules in `ViewModels/SignupViewRules.swift` |
| **Enum** | .NET `WildwoodComponents.Shared/Utilities/SignupPlanDefault.cs`; `SignupPlanDefault` in JS and Swift |

**One rule, identical everywhere**: the default tier is the catalog's **first free tier**, only when
`planDefault` is `free`, and **never in invite mode** (an invite's plan comes from its token). It is
a **HIGHLIGHT only** — **none of the four machine ports takes it as input**, so the signup machine
never sees it and the visitor still confirms with a click. Precedence is
`selection ?? default ?? link-preselected tier`: the default sits **ahead** of the link's `?tier=`
on purpose, because a stale or hand-edited id is one the flow already refused, and the grid should
open on the host's default rather than on nothing at all.

**Disclaimer test hooks.** The same three controls, spelled the way each stack can carry them:

| Control | React | Blazor / Razor | Swift |
|---|---|---|---|
| Retry a failed load | `data-ww-disclaimer-action="retry"` | — | `disclaimer-retry` |
| Accept ONE disclaimer | `data-ww-disclaimer-action="accept"` | — | `disclaimer-accept` (the card's toggle) |
| Submit / accept all | `data-ww-disclaimer-action="accept-all"` | `data-ww-disclaimer-action="accept-all"` | `disclaimer-accept-all` |

The .NET omissions are **not gaps**: the Blazor and Razor disclaimer surfaces have one accept
button and no retry, so there is no control to hang the other two on. Swift uses
`accessibilityIdentifier` because a SwiftUI element carries one identifier rather than a bag of
attributes; the flat `disclaimer-`-prefixed namespace is `ViewModels/DisclaimerTestID.swift`.

**Consent banner "reserve space".** React's fixed banner measures itself and adds its height to the
page's padding so it stops covering the content. Ported to Blazor (`wwwroot/js/wildwood-consent.js`)
and Razor (`wwwroot/js/consent.js`) as a **textually identical pure block** (delimited by
`// ---- BEGIN/END shared reserve-space bookkeeping ----` and asserted line-for-line by
`AttributionConsentGateSourceTests`, trimmed so the Razor copy's IIFE indentation does not count as
a difference; exercised by `WildwoodComponents.Tests/Razor/js/consent-reserve-space.selftest.mjs`).
The .NET port adds a **per-banner ledger**, because a page may host more than one: per edge it
reserves the page's own padding **plus the tallest live claim**, the page's own padding is captured
once and restored exactly, and the property is removed outright when there was none.
`--ww-consent-height` publishes the tallest live banner. Opt-out is `reserveSpace` (React, Blazor) /
`reserve-space` (Razor), default true. Only the top/bottom **bars** pad the page — see the
corner-card decision above. **N/A on Swift and React Native**: both banners sit in the host's layout
flow (RN's `styles.banner` carries no absolute positioning), so nothing is ever covered and there is
nothing to reserve.

**Not ported, by design**: `@wildwood/react/testing` and the exact Playwright pin — see the
"web-only pieces" decision above.

**Process note.** A long-running sync must **re-fetch every sibling `main` before opening PRs**:
GitHub starts no `pull_request` CI on a conflicting PR, so a branch that has drifted sits green-less
rather than failing loudly.

**Swift compile gate.** Every Swift change in this sync was authored on Windows and reviewed
read-for-compile only. None of it has been compiled: macOS CI `build-test` on the PR is the first
real compile, and until it is green the Swift half of this sync is unverified. If it fails, the
two places to look first are the `WildwoodMoney` currency fixtures (they assume Foundation's
`en_US` currency style equals `Intl`'s) and the test app's `@Sendable` capture of
`TestEventLog`.
