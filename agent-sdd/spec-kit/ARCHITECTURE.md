# Architecture
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads this file but never modifies it.
# Updated by tech lead when architecture decisions change.
# ─────────────────────────────────────────────────────────────────────────────

## Current State

### Module Structure

| Gradle Module / Package | Language | Pattern | DI | Notes |
|------------------------|----------|---------|-----|-------|
| :app | Kotlin | Single Activity | Hilt | App entry point, NavHost, deep links |
| :feature-[name] | Kotlin | MVVM | Hilt | [describe feature] |
| :core-network | Kotlin | — | Hilt | Retrofit, OkHttp, interceptors |
| :core-data | Kotlin | Repository | Hilt | Room, DataStore |
| :core-ui | Kotlin | — | — | Shared composables, Material 3 theme |

<!-- Add rows for each module. Be specific about language — mixed Java/Kotlin is common. -->

### Navigation
<!-- Describe: NavGraph XML / Compose Navigation / manual fragment transactions / mix.
     State which Activity/Fragment hosts the NavHost. -->

[e.g., Single-activity with Jetpack Navigation Component. NavGraph in app/src/main/res/navigation/nav_graph.xml. MainActivity hosts the NavHostFragment.]

### Threading Model
<!-- List each async approach in use and where. -->

| Approach | Where used |
|----------|-----------|
| Kotlin Coroutines + Flow | All new code, :core-network, :core-data |
| RxJava 2 | [legacy modules — list them] |
| AsyncTask | [legacy screens — list them, mark for removal] |

### State Management

| Approach | Where used |
|----------|-----------|
| StateFlow | All new ViewModels |
| LiveData | [legacy ViewModels — list them] |
| RxJava Subjects | [legacy — list] |

### Networking

| Property | Value |
|----------|-------|
| Library | Retrofit [version] + OkHttp [version] |
| Base URL strategy | [single base URL / per-environment via BuildConfig / remote config] |
| Auth mechanism | [Bearer token injected by AuthInterceptor / API key header / none] |
| Custom interceptors | [list each and what it does] |

### Local Storage

| Approach | Where used |
|----------|-----------|
| Room [version] | [list databases and entities] |
| DataStore Preferences | [list what is stored] |
| SharedPreferences | [legacy — list keys, mark for migration] |

### Image Loading
[e.g., Coil 2.x — used in all feature modules via AsyncImage composable]

### Known Architecture Violations
<!-- Document so agent knows not to replicate. -->

- [File/class]: [what the violation is and why it exists]

---

## Target State

### Architecture Pattern
Clean Architecture + MVI
UI → ViewModel (MVI: intent → state) → UseCase → Repository → DataSource

### DI
Hilt everywhere. No manual wiring.

### Async
Kotlin Coroutines + Flow everywhere. RxJava removed.

### UI
- New screens: Jetpack Compose + Material 3
- Existing XML screens: kept until explicit migration ticket
- No new XML screens

### Navigation
Jetpack Navigation Component. Single-Activity. Type-safe destinations.

---

## Architecture Decision Records

### ADR-001 — [Title]
- **Date**: YYYY-MM-DD
- **Decision**: [What was decided]
- **Reason**: [Why this was chosen over alternatives]
- **Consequence**: [What this means for day-to-day development]

### ADR-002 — New screens use Compose; existing XML screens stay until migration ticket
- **Date**: [fill in]
- **Decision**: Do not rewrite existing XML screens unless a ticket explicitly scopes it.
- **Reason**: Rewriting UI without adding user value introduces risk with no benefit.
- **Consequence**: Codebase has mixed XML and Compose. Agent must not assume all UI is Compose.

<!-- Add ADRs whenever a significant architectural decision is made. -->
