# WildwoodComponents.Sync

## Overview

Coordination workspace for the WildwoodComponents ecosystem — a component library implemented in both .NET and JavaScript that provides authentication, AI, messaging, payments, subscriptions, notifications, and more.

These are two completely separate technology stacks. Each project is independent with its own shared library — there is no cross-project shared code.

## Repository Structure

This repo (`WildwoodComponents.Sync`) is a meta-repository that coordinates development across two sibling projects:

| Project | Path | Description |
|---------|------|-------------|
| **WildwoodComponents.Net** | `C:\Development\WildwoodComponents.Net\Dev` | .NET 10 component library (Blazor + Razor) |
| **WildwoodComponents.JS** | `C:\Development\WildwoodComponents.JS\Dev` | TypeScript SDK monorepo (React + React Native + Node.js) |

The VS Code workspace file (`WildwoodComponents.code-workspace`) opens both projects side-by-side.

## Architecture

### .NET Architecture (WildwoodComponents.Net)

Self-contained .NET solution with its own internal shared library:

```
WildwoodComponents.Shared        ← .NET shared library: models, DTOs, utilities
  ├─► WildwoodComponents.Blazor  ← Blazor interactive components (29 components)
  └─► WildwoodComponents.Razor   ← Razor ViewComponents for MVC (30 components)
```

- **WildwoodComponents.Shared** is the .NET-internal shared library. It holds models (`AppTierModels`, `WildwoodAuthModels`, `PaymentProviderModels`, etc.), utilities (`FormatHelpers`, `TokenExpiryParser`, `SessionConstants`), and is consumed by both Blazor and Razor projects within the .NET solution.
- **WildwoodComponents.Blazor** has its own services layer, base component class (`BaseWildwoodComponent`), JS interop scripts, and payment script providers.
- **WildwoodComponents.Razor** has its own services layer (server-side HTTP calls), ViewComponent classes, Razor views, cookie auth helpers, and middleware.
- **Test Suite**: `WildwoodComponentsTestSuiteBlazor` — Blazor web app with 25 test pages.

### JS Architecture (WildwoodComponents.JS)

Self-contained pnpm monorepo with its own internal shared library:

```
@wildwood/core                   ← JS shared library: services, types, utilities (framework-agnostic TS)
  ├─► @wildwood/react-shared     ← Shared React hooks (business logic, no UI)
  │     ├─► @wildwood/react      ← React components + hooks (59 components, 20 hooks)
  │     └─► @wildwood/react-native ← React Native components (31 components)
  └─► @wildwood/node             ← Node.js/Express middleware + admin client
```

- **@wildwood/core** is the JS-internal shared library. Pure TypeScript, zero UI dependencies. Contains `AuthService`, `AIService`, `MessagingService`, `PaymentService`, `SubscriptionService`, `TwoFactorService`, `CaptchaService`, `AppTierService`, `DisclaimerService`, `NotificationService`, `ThemeService`, `WildwoodEventEmitter`, `WildwoodClient`, and all shared types. Consumed by all other JS packages.
- **@wildwood/react-shared** holds 22 hooks with pure business logic (no UI) shared between React web and React Native.
- **@wildwood/react** wraps core services with React components and re-exports shared hooks.
- **@wildwood/react-native** provides native mobile components using the same shared hooks.
- **@wildwood/node** provides Express middleware (`authMiddleware`, `rateLimitMiddleware`, `proxyMiddleware`) and `adminClient` for server-to-server operations.
- **Test Suite**: `WildwoodComponentsTestSuite.React` — Vite + React app with 15 test pages.

### Shared Library Equivalence

Each project has its own shared library serving the same purpose within its tech stack:

| .NET (internal) | JS (internal) | Purpose |
|------|----|---------|
| `WildwoodComponents.Shared` | `@wildwood/core` | Shared models, types, utilities for the project |
| (within Blazor services) | `@wildwood/react-shared` | Shared business logic between component sets |
| `WildwoodComponents.Blazor` | `@wildwood/react` | Web interactive components |
| `WildwoodComponents.Razor` | `@wildwood/react-native` | Alternative platform components |
| (no equivalent) | `@wildwood/node` | Server-side SDK |

## Component Inventory (26 components at parity)

Both .NET and JS implement these components:
- **AI**: AIChatComponent, AIFlowComponent, AIProxyComponent
- **Auth**: AuthenticationComponent, TokenRegistrationComponent, SignupWithSubscriptionComponent
- **Subscriptions**: SubscriptionComponent, SubscriptionManagerComponent, SubscriptionAdminComponent (+ 6 admin sub-panels: StatusPanel, TierPlansPanel, FeaturesPanel, AddOnsPanel, UsageLimitsPanel, OverridesPanel)
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

## Parity

The purpose of this Sync workspace is to track parity between the two independent projects. They implement the same component library for the same backend API, so their models, service methods, and component features should stay aligned — but each implementation is idiomatic to its own tech stack.

Key parity dimensions:
- **Models/types** — Should match field-for-field (adjusted for naming conventions: PascalCase .NET, camelCase JS)
- **Service methods** — Should cover the same API endpoints
- **Components** — Should provide the same user-facing features
- **API endpoint paths** — Both projects call the same WildwoodAPI backend, so endpoint paths must match
- **Storage keys** — Both projects may use browser localStorage, so key names should be aligned
