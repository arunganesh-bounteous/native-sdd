# Conventions
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent reads this and follows it exactly. Never modifies it.
# These rules override the defaults in CLAUDE.md where they conflict.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: follow every convention in this file exactly. These are non-negotiable.
> When in doubt between two approaches, the one described here wins.

---

## Kotlin Core Rules

- No `!!` null assertions. Use `?.let {}`, `?: return`, or `requireNotNull(x) { "msg" }`.
- No `lateinit var` except Hilt-injected fields (`@Inject lateinit var`). Prefer constructor injection.
- Prefer `val` over `var`.
- Use `data class` for all model/state/event types. No mutable `var` fields in data classes.
- Every `when` on a sealed class or sealed interface must be exhaustive. Never use `else` on sealed types.
- Use `object` for singletons.
- Prefer named arguments when calling functions with 3+ parameters of the same type.
- Extension functions go in a dedicated `[Subject]Extensions.kt` file in the same package.

### Anti-patterns (agent must never write these)

```kotlin
// ❌ Null assertion
val name = user!!.name

// ✅ Safe unwrap
val name = user?.name ?: return

// ❌ else on sealed type — misses future cases
when (state) {
    is Loading -> showSpinner()
    else -> hideSpinner()
}

// ✅ Exhaustive — compiler catches missing cases
when (state) {
    is Loading -> showSpinner()
    is Success -> showContent(state.data)
    is Error   -> showError(state.message)
}

// ❌ var in data class
data class User(var name: String, var email: String)

// ✅ Immutable data class
data class User(val name: String, val email: String)
```

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Classes, Objects, Interfaces | PascalCase | `LoginViewModel`, `AuthRepository` |
| Functions, Properties | camelCase, verb-first for functions | `loadUser()`, `onLoginClicked()` |
| Constants | `SCREAMING_SNAKE_CASE` in `companion object` | `MAX_RETRY_COUNT` |
| Resource IDs — Views | `type_description` | `tv_title`, `btn_submit`, `iv_avatar` |
| Resource IDs — Layouts | `fragment_name` / `item_name` | `fragment_login`, `item_order` |
| Drawables | `ic_name` (icons), `bg_name` (backgrounds) | `ic_back`, `bg_card` |
| String resources | `module_element_description` | `login_error_invalid_email` |
| Test files | `[SourceClass]Test` | `LoginViewModelTest` |
| Test functions | `functionName_scenario_expectedResult` | `onLoginClicked_invalidEmail_showsError` |

---

## Package Structure (per feature module)

```
com.[package].feature.[name]/
├── ui/
│   ├── [Name]Fragment.kt          (XML screens — legacy only)
│   ├── [Name]Screen.kt            (Compose screens — new screens)
│   ├── [Name]ViewModel.kt
│   ├── [Name]UiState.kt           (data class with default values)
│   └── [Name]Intent.kt            (sealed class — one per user action)
├── domain/
│   ├── model/                     (pure Kotlin entities — no Android imports)
│   └── usecase/                   (one class per use case)
└── data/
    ├── [Name]Repository.kt        (interface in domain, impl here)
    ├── remote/
    │   ├── [Name]RemoteDataSource.kt
    │   └── [Name]ApiService.kt    (Retrofit interface)
    └── local/
        └── [Name]LocalDataSource.kt
```

---

## ViewModel Conventions

- Expose state as `StateFlow<[Name]UiState>` — never `LiveData`.
- Expose one-shot navigation/events as `SharedFlow<NavigationEvent>` — separate from UiState.
- No Android framework imports in ViewModel (`Context`, `View`, `FragmentManager` are banned).
- No direct DataSource calls — always through UseCase or Repository.
- All coroutines launched with `viewModelScope.launch { }`. Never `GlobalScope`.
- Process user actions via a single `processIntent(intent: [Name]Intent)` function.

```kotlin
// ✅ Correct ViewModel structure
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val loginUseCase: LoginUseCase
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _navigationEvent = MutableSharedFlow<NavigationEvent>()
    val navigationEvent: SharedFlow<NavigationEvent> = _navigationEvent.asSharedFlow()

    fun processIntent(intent: LoginIntent) {
        when (intent) {
            is LoginIntent.EmailChanged    -> _uiState.update { it.copy(email = intent.value) }
            is LoginIntent.PasswordChanged -> _uiState.update { it.copy(password = intent.value) }
            is LoginIntent.SubmitLogin     -> submitLogin()
            is LoginIntent.NavigateToRegister -> {
                viewModelScope.launch { _navigationEvent.emit(NavigationEvent.ToRegister) }
            }
        }
    }

    private fun submitLogin() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, generalError = null) }
            loginUseCase(email = _uiState.value.email, password = _uiState.value.password)
                .onSuccess { _navigationEvent.emit(NavigationEvent.ToHome) }
                .onFailure { _uiState.update { s -> s.copy(isLoading = false, generalError = it.message) } }
        }
    }
}
```

```kotlin
// ✅ Correct UiState — data class, all fields have defaults
data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val emailError: String? = null,
    val passwordError: String? = null,
    val generalError: String? = null
    // ❌ Never add navigation flags here: navigateToHome: Boolean = false
)
```

```kotlin
// ✅ Correct Intent — sealed class, one subclass per user action
sealed class LoginIntent {
    data class EmailChanged(val value: String) : LoginIntent()
    data class PasswordChanged(val value: String) : LoginIntent()
    object SubmitLogin : LoginIntent()
    object NavigateToRegister : LoginIntent()
}
```

### Anti-patterns (agent must never write these)

```kotlin
// ❌ Multiple LiveData fields instead of unified state
private val _isLoading = MutableLiveData<Boolean>()
private val _errorMessage = MutableLiveData<String>()
private val _email = MutableLiveData<String>()

// ❌ Navigation flag inside UiState
data class LoginUiState(val navigateToHome: Boolean = false)

// ❌ Android import in ViewModel
class LoginViewModel : ViewModel() {
    fun showToast(context: Context) { ... }  // banned
}

// ❌ Direct DataSource call from ViewModel
class LoginViewModel @Inject constructor(
    private val authRemoteDataSource: AuthRemoteDataSource  // banned — use UseCase
)
```

---

## Coroutines and Flow

- `Dispatchers.IO` for all database and network operations.
- `Dispatchers.Main` is the default in `viewModelScope` — no need to specify for UI updates.
- Never use `GlobalScope` — always scope to `viewModelScope` or a DI-provided `CoroutineScope`.
- Never use `Thread.sleep()` — use `delay()`.
- Cold-to-warm flows: `stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), initialValue)`.
- Repository functions return `Result<T>` — never throw across layer boundaries.

```kotlin
// ✅ Correct repository suspend function
suspend fun login(email: String, password: String): Result<User> = runCatching {
    val response = apiService.login(LoginRequest(email, password))
    response.toDomain()
}

// ❌ Callback-based (legacy — do not add new ones)
fun login(email: String, onSuccess: (User) -> Unit, onError: (Throwable) -> Unit)
```

---

## Jetpack Compose (new screens only)

- Composables are **stateless** — receive state as parameters, emit events via lambda callbacks.
- No business logic inside `@Composable` functions.
- No ViewModel access inside composables — hoist to screen-level composable only.
- Use `collectAsStateWithLifecycle()` — not `collectAsState()`.
- Material 3 components only. No Material 2 imports in new screens.
- Previews use `@PreviewLightDark` or `@Preview(showBackground = true)`.

```kotlin
// ✅ Correct Screen composable — stateless, ViewModel at top level only
@Composable
fun LoginScreen(
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(Unit) {
        viewModel.navigationEvent.collect { event ->
            when (event) {
                NavigationEvent.ToHome -> navController.navigate(NavRoutes.HOME)
            }
        }
    }

    LoginContent(uiState = uiState, onIntent = viewModel::processIntent)
}

// ✅ Pure content composable — no ViewModel, fully testable
@Composable
fun LoginContent(
    uiState: LoginUiState,
    onIntent: (LoginIntent) -> Unit
) { ... }

// ❌ ViewModel inside a non-screen composable
@Composable
fun LoginButton() {
    val viewModel: LoginViewModel = hiltViewModel()  // banned — hoist to screen level
}
```

---

## Resources

- All user-visible text in `strings.xml`. No hardcoded strings in code or layouts.
- Colors: `?attr/colorPrimary` in XML, `MaterialTheme.colorScheme.*` in Compose. Never hardcode hex values.
- Dimensions: use `dimens.xml` or design token system. No magic number `dp` values inline.
- Drawables: vector XML only (`VectorDrawable`). No raster PNG/JPG unless strictly required by brand asset.

---

## Dependency Injection (Hilt)

- All ViewModels: `@HiltViewModel` + `@Inject constructor`. No manual instantiation.
- All repositories and data sources: `@Inject constructor`. No `companion object` factories.
- DI module files live in `di/` package inside each feature or core module.
- Repositories scoped `@Singleton`. ViewModels are automatically scoped by Hilt.
- No `@ActivityScoped` or `@FragmentScoped` for business logic — only for UI-bound resources.

```kotlin
// ✅ Correct Hilt module
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAuthRepository(impl: AuthRepositoryImpl): AuthRepository = impl

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): AuthApiService =
        retrofit.create(AuthApiService::class.java)
}
```

---

## Quality Gate

> Agent (Step 6b): scan every file you created or modified against every check in
> this table. For each failure: fix it before proceeding. Log what you fixed in
> Self-Corrections (Step 6c).

| Check | Rule |
|-------|------|
| No `!!` operators | Use `?.let {}`, `?: return`, or `requireNotNull` |
| No new `LiveData` | New state uses `StateFlow` only |
| No `GlobalScope` | All coroutines in `viewModelScope` or `lifecycleScope` |
| No hardcoded strings | All user-visible text in `strings.xml` |
| No hardcoded colors or dimensions | Use theme attributes or `dimens.xml` |
| Sealed types are exhaustive | No `else` on `when` over sealed class/interface |
| No business logic in UI layer | Composables, Fragments, Activities call ViewModel only |
| ViewModel has no Android imports | No `Context`, `View`, `FragmentManager` |
| DTOs/Entities not exposed to UI | Repository/Manager returns domain models only |
| Tests follow naming convention | `functionName_scenario_expectedResult` |

<!-- For non-Android platforms: replace this table entirely with your platform's
     equivalent quality checks. The agent reads this table regardless of platform
     as defined in CLAUDE.md Step 6b. -->
