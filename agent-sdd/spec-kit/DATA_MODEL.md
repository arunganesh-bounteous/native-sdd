# Data Model
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads this only when a task touches data models,
# APIs, DB schema, or network calls. Never modifies.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: load this file for any task involving network calls, data models, Room, or API endpoints.
> The mapping rules are non-negotiable — never expose DTOs or Room entities to the UI layer.

---

## Mapping Conventions

Every data type lives in exactly one layer. Mapping always flows inward — never outward.

```
Network DTO  ──→  Domain model  ──→  UI model
DB Entity    ──→  Domain model  ──→  UI model
```

| Mapping | Where it happens | Example |
|---------|-----------------|---------|
| Network DTO → Domain model | Repository or Manager (maps `[ApiResponse]` → `[DomainModel]`) | `response.data.field → DomainModel.field` |
| Domain model → UI model | ViewModel exposes `StateFlow<[DomainModel]>` | `[Feature]ViewModel.[domainModel]` |

### Anti-patterns (agent must never do these)

```kotlin
// ❌ Passing API response directly to the ViewModel or UI
class [FeatureManager] {
    fun getData(): [ApiResponse]  // banned — map to domain first
}

// ❌ Fragment reading raw response fields
binding.someView.text = response.data.someField  // banned

// ✅ Manager/Repository maps response to domain model
data class [DomainModel](
    val fieldOne: Boolean = false,
    val fieldTwo: String? = null
)

// ✅ ViewModel exposes domain model via StateFlow
val domainData: StateFlow<[DomainModel]> = _domainData.asStateFlow()

// ✅ Fragment observes StateFlow
viewModel.domainData.collect { data ->
    binding.someView.text = data.fieldTwo
}
```

---

## Domain Entities

<!-- Add one section per domain model using the format below. -->

### [DomainModel] (domain model — lives in [Manager or ViewModel])

```kotlin
data class [DomainModel](
    val fieldOne: Boolean = false,   // sourced from [ApiResponse].data.field_one
    val fieldTwo: String? = null     // sourced from [ApiResponse].data.field_two
)
```

| Field | Type | Source |
|-------|------|--------|
| `fieldOne` | `Boolean` | `[ApiResponse].data.field_one` |
| `fieldTwo` | `String?` | `[ApiResponse].data.field_two` |

---

## API Contracts

> API contracts (request/response shapes, field-level notes, gotchas) belong in each
> module's `context/<module>.md` file under an **API Contracts** section, not here.
>
> Reasons: contracts change every sprint while domain models rarely do; the agent loads
> only the context files relevant to the current task, so keeping contracts there avoids
> paying the token cost for unrelated endpoints.
>
> Base URLs and auth mechanism live in `ARCHITECTURE.md` under Networking.
