# Module Map
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent uses this as the navigation backbone.
# Never modifies. Updated when a new module is added.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: this file is the module **registry** — use it for module paths, patterns, key
> classes, and debt anchors. For keyword-based routing, use `context/_index.md` (Tier 3).
> If a context file is missing, use the path and key classes here to find source files.

## How the Agent Uses This File

1. After loading `context/_index.md` and routing to a context file, come here when you need:
   - The source path for a module (`Path` field)
   - The key classes to read if no context file exists yet
   - The tech debt anchor (`TECH_DEBT.md#<section>`) for a module
2. If a module has no context file yet: use `Key classes` here to identify the 5–8 files to read.
3. After completing a task on a new module: generate `context/<module>.md` using `context/TEMPLATE.md`,
   then add a routing row to `context/_index.md`.

**Routing lives in `context/_index.md`, not here.**
The Keywords field in this file is for human reference. The agent routes via `_index.md`.

---

## Module Index

### :app — Main Application

| Field | Value |
|-------|-------|
| Path | `app/src/main/java/com/[package]/` |
| Language | Kotlin |
| Pattern | Single Activity + Hilt |
| DI | Hilt |
| Purpose | App entry point, navigation, all feature UI |
| Keywords | app, main, startup, launch, navhost, deep link, application |
| Key classes | `[ProjectName]Application.kt`, `MainActivity.kt` |
| Depends on | All feature modules |
| Context file | `context/app.md` |
| Known debt | see `TECH_DEBT.md#app` |

---

### :feature-auth — Authentication

| Field | Value |
|-------|-------|
| Path | `app/src/main/java/com/[package]/views/auth/` |
| Language | Kotlin |
| Pattern | MVVM + Hilt |
| DI | Hilt |
| Purpose | Sign in, sign up, sign out, session management |
| Keywords | login, logout, sign in, sign up, session, token, auth, biometric, password, register, authentication |
| Key classes | `[fill in]` |
| Depends on | `:core` |
| Context file | `context/auth.md` |
| Known debt | see `TECH_DEBT.md#auth` |

---

### :feature-home — Home / Dashboard

| Field | Value |
|-------|-------|
| Path | `app/src/main/java/com/[package]/views/home/` |
| Language | Kotlin |
| Pattern | MVVM + Hilt |
| DI | Hilt |
| Purpose | Home screen, dashboard, landing page |
| Keywords | home, dashboard, feed, landing, main screen, summary |
| Key classes | `[fill in]` |
| Depends on | `:core` |
| Context file | `context/home.md` |
| Known debt | see `TECH_DEBT.md#home` |

---

### :core-network — Core Networking

| Field | Value |
|-------|-------|
| Path | `core/src/main/java/com/[package]/network/` |
| Language | Kotlin |
| Pattern | Infrastructure — Retrofit API + service layer |
| DI | Hilt |
| Purpose | HTTP client, interceptors, base Retrofit setup, request/response models |
| Keywords | network, API, http, retrofit, endpoint, interceptor, base url |
| Key classes | `[fill in]` |
| Depends on | Nothing internal |
| Context file | `context/core-network.md` |
| Known debt | see `TECH_DEBT.md#network` |

---

### :core-data — Core Data / Persistence

| Field | Value |
|-------|-------|
| Path | `core/src/main/java/com/[package]/data/` |
| Language | Kotlin |
| Pattern | Repository + DataSource |
| DI | Hilt |
| Purpose | Room database, DataStore preferences, local caching |
| Keywords | database, room, datastore, cache, local storage, preferences, dao |
| Key classes | `[fill in]` |
| Depends on | Nothing internal |
| Context file | `context/core-data.md` |
| Known debt | see `TECH_DEBT.md#data` |

---

<!-- Add one entry per module using the format above.
     Keep Keywords field for human reference.
     Agent routes via context/_index.md — not via this file. -->
