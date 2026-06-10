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
WildwoodComponents.Shared        ← .NET shared library: models, DTOs, utilities
  ├─► WildwoodComponents.Blazor  ← Blazor interactive components (27 components)
  └─► WildwoodComponents.Razor   ← Razor ViewComponents for MVC (28 components)
```

- **WildwoodComponents.Shared** is the .NET-internal shared library. It holds models (`AppTierModels`, `WildwoodAuthModels`, `PaymentProviderModels`, etc.), utilities (`FormatHelpers`, `TokenExpiryParser`, `SessionConstants`), and is consumed by both Blazor and Razor projects within the .NET solution.
- **WildwoodComponents.Blazor** has its own services layer, base component class (`BaseWildwoodComponent`), JS interop scripts, and payment script providers.
- **WildwoodComponents.Razor** has its own services layer (server-side HTTP calls), ViewComponent classes, Razor views, cookie auth helpers, and middleware.
- **Test Suite**: `WildwoodComponentsTestSuiteBlazor` — Blazor web app with 23 test pages.

### JS Architecture (WildwoodComponents.JS)

Self-contained pnpm monorepo with its own internal shared library:

```
@wildwood/core                   ← JS shared library: services, types, utilities (framework-agnostic TS)
  ├─► @wildwood/react-shared     ← Shared React hooks (business logic, no UI)
  │     ├─► @wildwood/react      ← React components + hooks (57 components, 19 hooks)
  │     └─► @wildwood/react-native ← React Native components (29 components)
  └─► @wildwood/node             ← Node.js/Express middleware + admin client
```

- **@wildwood/core** is the JS-internal shared library. Pure TypeScript, zero UI dependencies. Contains `AuthService`, `AIService`, `MessagingService`, `PaymentService`, `TwoFactorService`, `CaptchaService`, `AppTierService`, `DisclaimerService`, `NotificationService`, `ThemeService`, `WildwoodEventEmitter`, `WildwoodClient`, and all shared types. Consumed by all other JS packages.
- **@wildwood/react-shared** holds 21 hooks with pure business logic (no UI) shared between React web and React Native.
- **@wildwood/react** wraps core services with React components and re-exports shared hooks.
- **@wildwood/react-native** provides native mobile components using the same shared hooks.
- **@wildwood/node** provides Express middleware (`authMiddleware`, `rateLimitMiddleware`, `proxyMiddleware`) and `adminClient` for server-to-server operations.
- **Test Suite**: `WildwoodComponentsTestSuite.React` — Vite + React app with 13 test pages.

### Swift Architecture (WildwoodComponents.Swift)

Self-contained SPM package (two products) with its own internal shared library:

```
WildwoodCore                     ← Swift shared library: services, models, session/token mgmt (zero UI imports)
  └─► WildwoodSwiftUI            ← SwiftUI components (29) + @Observable view models
        ├─ ViewModels/           ← ≈ @wildwood/react-shared (no `import SwiftUI`)
        └─ Components/           ← ≈ @wildwood/react-native (iOS-gated)
```

- **WildwoodCore** mirrors `@wildwood/core` method-for-method: `WildwoodClient` factory exposing `auth`, `session`, `ai`, `messaging`, `payment`, `appTier`, `twoFactor`, `captcha`, `disclaimer`, `feedback`, `notifications`, `theme`, `events`, `http`. Swift 6 strict concurrency: `WildwoodHttpClient` is an actor; `SessionManager`/`NotificationService`/`ThemeService` are `@MainActor @Observable`. Tokens go to the Keychain, other `ww_` keys to UserDefaults (CompositeStorage).
- **Payments are processor-agnostic**: provider selection is backend-driven via `PlatformFilteredProvidersDto`; the App Store path runs StoreKit 2 and validates JWS against `api/payment/validate-apple-receipt`, others use generic `initiatePayment`/`confirmPayment` with web checkout — all payment/subscription state remains in Wildwood.
- **Test Suite**: `WildwoodComponentsTestSuite.iOS` — XcodeGen-defined SwiftUI app with 17 test screens (`project.yml` checked in, `.xcodeproj` generated on a Mac).
- iOS 26 minimum deployment; iOS 27 features behind `@available(iOS 27, *)`. Builds/tests require macOS (Xcode 27 beta); code can be authored on Windows.

### Shared Library Equivalence

Each project has its own shared library serving the same purpose within its tech stack:

| .NET (internal) | JS (internal) | Swift (internal) | Purpose |
|------|----|----|---------|
| `WildwoodComponents.Shared` | `@wildwood/core` | `WildwoodCore` | Shared models, types, utilities for the project |
| (within Blazor services) | `@wildwood/react-shared` | `WildwoodSwiftUI/ViewModels` | Shared business logic between component sets |
| `WildwoodComponents.Blazor` | `@wildwood/react` | `WildwoodSwiftUI` | Interactive components |
| `WildwoodComponents.Razor` | `@wildwood/react-native` | (single UI framework) | Alternative platform components |
| (no equivalent) | `@wildwood/node` | (no equivalent) | Server-side SDK |

## Component Inventory (23 components at parity)

All three stacks implement these components:
- **AI**: AIChatComponent, AIProxyComponent
- **Auth**: AuthenticationComponent, TokenRegistrationComponent, SignupWithSubscriptionComponent
- **Subscriptions**: SubscriptionAdminComponent (+ 6 admin sub-panels: StatusPanel, TierPlansPanel, FeaturesPanel, AddOnsPanel, UsageLimitsPanel, OverridesPanel) — tier-based; the legacy SubscriptionComponent/SubscriptionManagerComponent were removed June 2026 (they targeted a nonexistent `api/subscription/*` backend)
- **Payment**: PaymentComponent, PaymentFormComponent
- **Pricing/Tiers**: PricingDisplayComponent, AppTierComponent
- **Security**: TwoFactorSettingsComponent
- **Messaging**: SecureMessagingComponent
- **Notifications**: NotificationComponent, NotificationToastComponent
- **Usage**: UsageDashboardComponent, OverageSummaryComponent
- **Legal**: DisclaimerComponent

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
