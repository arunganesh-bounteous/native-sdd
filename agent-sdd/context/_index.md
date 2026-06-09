# Context Index
# ─────────────────────────────────────────────────────────────────────────────
# THIS IS THE AUTHORITATIVE ROUTING TABLE.
# Agent uses this table — and only this table — to decide which
# context/<module>.md files to load for a given task.
# spec-kit/MODULE_MAP.md is the module registry (metadata); this file routes.
# Seeded by humans; grows as new modules are added.
# ─────────────────────────────────────────────────────────────────────────────

## How to Use (Agent)

1. Read the task MD: description, acceptance criteria, affected areas.
2. Match task keywords against the Keywords column in this file.
3. Load every context file that matches before reading any source files.
4. If no match: check `spec-kit/MODULE_MAP.md` by package/module name for richer metadata.
5. If still no match: read 5–8 key source files, then generate a context file afterward.

For tasks touching >1 module: load ALL matching context files, then proceed.

---

## Keyword Routing Table

| Keywords | Module | Context File |
|----------|--------|--------------|
| login, logout, sign in, sign out, session, token, auth, biometric, password, register, authentication | Authentication | `context/auth.md` |
| home, dashboard, feed, landing, main screen, summary | Home | `context/home.md` |
| profile, account, settings, preferences, avatar, edit profile | Profile / Settings | `context/profile.md` |
| payment, checkout, billing, card, transaction, purchase, order | Payment / Checkout | `context/checkout.md` |
| onboarding, splash, welcome, walkthrough, first launch | Onboarding | `context/onboarding.md` |
| notification, push, FCM, alert, badge, messaging | Notifications | `context/notifications.md` |
| network, API, http, retrofit, endpoint, interceptor, base url | Core Network | `context/core-network.md` |
| database, room, datastore, cache, local storage, preferences, dao | Core Data | `context/core-data.md` |
| theme, color, typography, design token, shared component, button, card, composable | Core UI | `context/core-ui.md` |
| analytics, tracking, firebase, event, screen view | Analytics | `context/analytics.md` |

<!-- Add a row here whenever you add a new context/<module>.md file. -->

---

## Notes for Humans

- `_index.md` (this file) — agent routing table: keyword → context file
- `MODULE_MAP.md` — module registry: path, pattern, DI, key classes, debt anchor
- Keep both in sync when adding a new module.
