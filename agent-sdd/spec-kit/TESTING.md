# Testing Standards
# ─────────────────────────────────────────────────────────────────────────────
# HUMAN-AUTHORED. Agent loads this whenever a task requires writing tests.
# Never modifies. Overrides defaults in CLAUDE.md.
# ─────────────────────────────────────────────────────────────────────────────

> Agent: read this file in full before writing any test. Follow every rule
> exactly. Do not write tests for code you did not add or modify in this task.
> One test class per source class — no exceptions.

## Framework Stack

| Purpose | Library | Version |
|---------|---------|---------|
| Unit test runner | JUnit 4 / JUnit 5 | [version] |
| Mocking | MockK | [version] |
| Flow / StateFlow testing | Turbine | [version] |
| Assertions | Google Truth | [version] |
| Coroutines test | kotlinx-coroutines-test | [version] |
| UI tests (optional) | Espresso | [version] |

<!-- Update versions to match your project's build.gradle -->

---

## Unit Test Rules

**What to test:**
- Every ViewModel (state transitions, event emissions, error paths)
- Every UseCase (business logic, validation, mapping)
- Every Repository (caching strategy, error handling)
- Every non-trivial utility function

**What NOT to test:**
- Android framework classes directly (Activity, Fragment, Service)
- Data classes with no logic
- Trivial wrappers with no branching logic
- Code you did not write or modify in this task

**One class per test file.** `LoginViewModelTest` tests only `LoginViewModel`.

### Test Function Naming — `functionName_scenario_expectedResult`

```kotlin
// ✅ Correct
fun onLoginClicked_withInvalidEmail_showsEmailError()
fun onLoginClicked_withValidCredentials_emitsNavigateToHome()
fun loadUser_whenNetworkFails_showsErrorState()

// ❌ Wrong — no scenario, no expected result
fun testLogin()
fun shouldWorkCorrectly()
fun loginTest()
```

---

## ViewModel Testing Pattern

```kotlin
class LoginViewModelTest {

    @get:Rule
    val mainDispatcherRule = MainDispatcherRule() // sets Dispatchers.Main to TestDispatcher

    private val loginUseCase: LoginUseCase = mockk()
    private lateinit var viewModel: LoginViewModel

    @Before
    fun setUp() {
        viewModel = LoginViewModel(loginUseCase)
    }

    @Test
    fun `onLoginClicked with valid credentials emits NavigateToHome`() = runTest {
        coEvery { loginUseCase(any(), any()) } returns Result.success(fakeUser())

        viewModel.navigationEvent.test {
            viewModel.processIntent(LoginIntent.SubmitLogin)
            assertThat(awaitItem()).isEqualTo(NavigationEvent.ToHome)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `onLoginClicked with invalid credentials shows error state`() = runTest {
        coEvery { loginUseCase(any(), any()) } returns Result.failure(Exception("Invalid credentials"))

        viewModel.processIntent(LoginIntent.SubmitLogin)
        advanceUntilIdle()

        assertThat(viewModel.uiState.value.generalError).isNotNull()
    }
}
```

---

## Flow / StateFlow Testing

- Always use Turbine for testing Flows and Channels.
- Use `runTest` from `kotlinx-coroutines-test` — never `runBlocking`.
- Use `advanceUntilIdle()` to drain pending coroutines before asserting state.
- Never use `Thread.sleep()` or `delay()` in tests.

```kotlin
// ✅ Turbine for SharedFlow events
viewModel.navigationEvent.test {
    viewModel.processIntent(LoginIntent.SubmitLogin)
    assertThat(awaitItem()).isEqualTo(NavigationEvent.ToHome)
    cancelAndIgnoreRemainingEvents()
}

// ✅ StateFlow assertion after coroutine drains
viewModel.processIntent(LoginIntent.SubmitLogin)
advanceUntilIdle()
assertThat(viewModel.uiState.value.isLoading).isFalse()

// ❌ Never block the thread
Thread.sleep(500)
assertThat(viewModel.uiState.value.isLoading).isFalse()
```

---

## Mocking Rules

- **MockK only.** Do not use Mockito.
- Mock interfaces and abstract classes. Never mock data classes or concrete implementations.
- Use `coEvery` for suspend functions, `every` for regular functions.
- Use `verify` to assert interaction counts only when the test's intent is about side effects.
  Don't add `verify` to every test by default.

```kotlin
// ✅ Mock the interface, not the implementation
private val repository: AuthRepository = mockk()  // interface ✅

// ❌ Never mock a data class or concrete class
private val user: User = mockk()            // data class — banned
private val impl: AuthRepositoryImpl = mockk() // concrete impl — banned

// ✅ coEvery for suspend functions
coEvery { repository.login(any(), any()) } returns Result.success(fakeUser())

// ✅ verify only for side-effect tests
verify(exactly = 1) { analyticsTracker.trackLogin() }
```

---

## Test File Location

Test files mirror the source tree:

| Source file | Test file |
|-------------|-----------|
| `app/src/main/.../LoginViewModel.kt` | `app/src/test/.../LoginViewModelTest.kt` |
| `feature/auth/.../AuthRepository.kt` | `feature/auth/src/test/.../AuthRepositoryTest.kt` |

---

## Integration Tests

Write integration tests when:
- A task changes a Room DAO — test with in-memory database, not mocked DAO
- A task changes a Retrofit service definition — test with MockWebServer

```kotlin
// ✅ Room integration test (in-memory DB — never mock the DAO)
@RunWith(AndroidJUnit4::class)
class UserDaoTest {
    private lateinit var db: AppDatabase
    private lateinit var dao: UserDao

    @Before
    fun setUp() {
        db = Room.inMemoryDatabaseBuilder(
            ApplicationProvider.getApplicationContext(),
            AppDatabase::class.java
        ).build()
        dao = db.userDao()
    }

    @After
    fun tearDown() = db.close()

    @Test
    fun insertAndRetrieveUser() = runTest {
        val user = UserEntity(id = "1", email = "a@b.com", displayName = "Test")
        dao.insert(user)
        assertThat(dao.getById("1")).isEqualTo(user)
    }
}
```

---

## Coverage Expectations

| Layer | Minimum coverage target |
|-------|------------------------|
| ViewModel | 80% |
| UseCase | 90% |
| Repository | 70% |
| Utility functions | 80% |

<!-- Adjust targets to match your team's bar. -->

These are targets for new code written in tasks. Pre-existing untouched code
is not subject to these targets per task.
