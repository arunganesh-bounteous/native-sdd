# Migration Rules
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads and applies automatically. Never modifies.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read every rule in this file before touching any file that matches
> the patterns described. Apply rules only to lines you add or the immediate
> surrounding context. Do not refactor untouched code — log it instead.

## The Principle

When a task modifies an existing file, the agent must:
1. Do what the task asks (primary obligation — always)
2. Apply the relevant rules below to lines it adds or the immediate surrounding context
3. NOT refactor the entire file unless the task explicitly scopes it

Agent never "improves" code outside task scope. Diffs stay reviewable. Risk stays controlled.

If the agent notices a violation in code it did not touch, it logs it in the completion
report under "Follow-up recommended" with file and line number — then moves on.

---

## Java Files

- Do not convert Java to Kotlin unless the task explicitly instructs it.
- When touching a Java file: write new logic in a separate Kotlin file that the Java calls.
- Do not add Kotlin-specific patterns inside `.java` files.
- Fix null-safety issues that the agent's own changes introduce. Not pre-existing ones.

Comment format when adding a TODO near Java code:
```java
// TODO [DEBT-XXX]: migrate to Kotlin — [brief reason]
```

---

## LiveData → StateFlow

- Do not migrate existing `LiveData` to `StateFlow` unless the task scopes it.
- When touching a ViewModel that uses `LiveData`:
  - Do not change existing `MutableLiveData` declarations.
  - Use `MutableStateFlow` for any new state added by this task.
  - Do not mix `observe()` and `collectAsStateWithLifecycle()` for the same state property.

```kotlin
// ❌ Adding new state as LiveData in a task
private val _isLoading = MutableLiveData<Boolean>()  // banned — new state uses StateFlow

// ✅ New state added by this task uses StateFlow alongside existing LiveData
private val _legacyUser = MutableLiveData<User>()        // existing — do not touch
private val _isLoading = MutableStateFlow(false)          // new state — StateFlow only
// TODO [DEBT-XXX]: migrate existing LiveData state to StateFlow
```

---

## RxJava → Coroutines

- Do not add new RxJava chains. Do not remove existing ones.
- When touching a file with RxJava:
  - Write all new async logic using Coroutines + Flow.
  - If new logic must interact with existing Rx: use `asFlow()` or `awaitFirst()` bridges.

```kotlin
// ❌ Adding a new RxJava chain
compositeDisposable.add(
    apiService.getUser(id)
        .subscribeOn(Schedulers.io())
        .observeOn(AndroidSchedulers.mainThread())
        .subscribe({ user -> ... }, { error -> ... })
)

// ✅ New async work uses coroutines; bridge to existing Rx only when required
viewModelScope.launch {
    val user = repository.getUser(id)  // suspend fun — new code
    _uiState.update { it.copy(user = user) }
}
// TODO [DEBT-XXX]: replace existing Rx chain in this file with coroutine
```

---

## MVP / MVC → MVVM

- Do not rewrite existing Presenters or Controllers.
- When a task adds functionality to an MVP/MVC screen:
  - Create a new ViewModel for the new logic only.
  - Wire the ViewModel alongside the existing Presenter.
  - Do not move existing Presenter logic into the ViewModel.

```kotlin
// ❌ Adding new business logic to an existing Presenter
class LoginPresenter {
    fun onNewFeatureClicked() {
        // new logic added here — banned
    }
}

// ✅ New logic lives in a new ViewModel wired alongside the Presenter
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val newFeatureUseCase: NewFeatureUseCase
) : ViewModel() {
    fun onNewFeatureClicked() { ... }
}
// TODO [DEBT-XXX]: consolidate into ViewModel once Presenter is removed
```

---

## Fragment with No ViewModel

- Do not add business logic directly to a Fragment.
- When adding state or business logic to a Fragment that has no ViewModel:
  - Create `[FeatureName]ViewModel.kt` in the same package.
  - Put the new logic in the ViewModel.
  - Do not refactor existing Fragment code.

---

## Direct Retrofit / API Calls (no Repository or DataSource)

- Do not add more direct API calls in Repositories or ViewModels.
- When touching a file that makes direct Retrofit calls:
  - Do not add more direct calls.
  - If the task requires a new network call: create `[Feature]RemoteDataSource.kt`, call it from the Repository.

```kotlin
// ❌ Adding a direct Retrofit call from ViewModel
class HomeViewModel @Inject constructor(
    private val apiService: HomeApiService  // banned — talk to Repository, not ApiService
)

// ✅ New network call goes through a DataSource
class HomeRemoteDataSource @Inject constructor(
    private val apiService: HomeApiService
) {
    suspend fun fetchFeed(): Result<List<FeedItem>> = runCatching {
        apiService.getFeed().map { it.toDomain() }
    }
}
```

---

## SharedPreferences → DataStore

- Do not add new SharedPreferences usage. Do not remove existing usage.
- When a task requires reading or writing preferences:
  - Use DataStore Preferences for all new preference keys.
  - Do not migrate existing SharedPreferences keys in the same task.

```kotlin
// ❌ Adding a new SharedPreferences key
prefs.edit().putBoolean("onboarding_complete", true).apply()  // banned for new keys

// ✅ New preference key uses DataStore
suspend fun setOnboardingComplete(complete: Boolean) {
    dataStore.edit { it[ONBOARDING_COMPLETE] = complete }
}
// TODO [DEBT-XXX]: migrate existing prefs keys to DataStore
```

---

## AsyncTask

- AsyncTask is deprecated. Never add or extend it.
- When touching a class that contains AsyncTask:
  - Do not add new work to the AsyncTask.
  - Implement new async work as a `suspend fun` called from ViewModel.

```kotlin
// ❌ Adding new work inside an existing AsyncTask
class UploadTask : AsyncTask<...>() {
    override fun doInBackground(vararg params: ...) {
        // adding new logic here — banned
    }
}

// ✅ New async work is a suspend fun in ViewModel
private fun uploadFile(file: File) {
    viewModelScope.launch(Dispatchers.IO) {
        repository.upload(file)
    }
}
// TODO [DEBT-XXX]: replace AsyncTask with coroutine
```

---

## New Screens and Features

All new screens and features use the target architecture. No exceptions.

When a task creates a new screen or feature:

| Layer | Rule |
|-------|------|
| UI | Jetpack Compose + Material 3 |
| ViewModel | MVI — `StateFlow` for state, `SharedFlow` for one-shot events |
| Domain | UseCase(s) per operation |
| Data | Repository + RemoteDataSource / LocalDataSource |
| DI | Hilt — `@HiltViewModel`, `@Singleton` for repositories |
| Async | Coroutines + Flow only |

No new MVP, MVC, Activities as feature containers, or XML layouts for new screens.

---

## Scope Guard

The agent does not apply migration rules to code it did not add or modify.
If the agent notices a violation in untouched code, it logs it in the completion
report under "Follow-up recommended" with the file path and line number.
It does not touch it.
