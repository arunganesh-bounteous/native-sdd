# Skill: Android PR Review

## Purpose
Perform a holistic, project-aware code review of a pull request.
Review the full change set as a coherent unit — understand the intent and type first,
then evaluate code quality. Never review file-by-file in isolation.

## Invocation
```
claude "Load .claude/skills/android-pr-review/SKILL.md and review this PR against <base-branch>"
```
The developer must supply the base branch explicitly (e.g. `main`, `develop`, `release/2.1`).

---

## Review Protocol

Execute every phase in order. Do not open individual files until Phase 2 is complete.

---

### Phase 0 — Confirm Base Branch

Verify the base branch exists and the current branch has diverged from it:
```bash
git fetch origin
git log origin/<base-branch>..HEAD --oneline
```
If the branch is up to date with base (no commits ahead), stop and tell the developer
there is nothing to review — the branch has not diverged.

---

### Phase 1 — PR Classification  *(before reading the diff)*

Determine what kind of PR this is before forming any opinion. This shapes the entire review.

```bash
# Current branch name — check for type prefix
git rev-parse --abbrev-ref HEAD

# All commit messages — scan for type keywords
git log origin/<base-branch>..HEAD --format="%s %b" --reverse

# Check for linked ticket references in commits or branch name
git log origin/<base-branch>..HEAD --format="%s %b" | grep -iE '([A-Z]+-[0-9]+|#[0-9]+)' || true
```

**Classify the PR into exactly one type:**

| Type | Branch prefix clues | Commit keyword clues |
|------|--------------------|--------------------|
| **Feature** | `feature/`, `feat/` | `feat:`, `add`, `implement`, `introduce` |
| **Bug Fix** | `bugfix/`, `fix/`, `hotfix/` | `fix:`, `bug:`, `patch:`, `resolve` |
| **Refactor** | `refactor/`, `cleanup/` | `refactor:`, `restructure`, `reorganize`, `move`, `rename` |
| **Task / Chore** | `task/`, `chore/`, `tech/`, `dep/` | `chore:`, `task:`, `bump`, `upgrade`, `update deps` |
| **Hotfix** | `hotfix/`, `release-fix/` | `hotfix:`, `critical fix` |

If the branch name and commits give conflicting signals, use the commit messages as the source of truth.
If classification is genuinely ambiguous, state "Unclassified — treating as Feature" and continue.

**Extract:**
- **Linked ticket**: JIRA key (`PROJECT-123`), GitHub issue (`#456`), or "None found"
- **Affected area**: which feature/module the changes touch (inferred from branch name or commits)

Hold this classification in mind — it controls what you flag as Critical vs Major in later phases.

---

### Phase 2 — Understand the PR  *(read before any file)*

**Do not open individual files yet.** Form a complete picture of the change.

```bash
# All commits in this PR (oldest → newest)
git log origin/<base-branch>..HEAD --oneline --reverse

# Detailed commit messages — understand the narrative
git log origin/<base-branch>..HEAD --format="%H %s%n%b" --reverse

# High-level scope: what files changed and how much
git diff --stat origin/<base-branch>...HEAD

# Overall diff (read fully before forming any opinion)
git diff origin/<base-branch>...HEAD
```

Answer these questions — **filtered by the PR type from Phase 1**:

**All types:**
1. **What does this PR do?** (2-3 sentences, in your own words)
2. **Is the scope coherent?** (one concern, or multiple unrelated changes?)
3. **Are the commit messages clear and atomic?**

**Feature:**
4. Is the feature complete, or are there half-built paths / TODO stubs left in production code?
5. Does it handle all UI states — loading, success, error, and empty?

**Bug Fix:**
4. Does the fix address the root cause or just the symptom?
5. Is the change minimal and focused, or does it bundle unrelated edits?
6. Is there a regression test that would have caught this bug before the fix?

**Refactor:**
4. Does it change any observable behaviour, or is it a pure structural move?
5. Do the existing tests cover the refactored code well enough to prove no regression?

**Task / Chore:**
4. Does it accidentally touch production logic, or is it strictly build/config/dependency changes?

**Hotfix:**
4. Is the change absolutely minimal — only what is needed to fix the issue?
5. Is it safe to cherry-pick onto a release branch without pulling in other work?

If the PR scope is too large to review meaningfully in one pass (> ~500 lines of production code),
flag this as a Major finding immediately.

---

### Phase 3 — Load Project Context

Read the project's own standards so the review is project-aware, not generic.
Skip any file that does not exist — do not error.

```bash
cat agent-artifacts/spec-kit/ARCHITECTURE.md   2>/dev/null || true
cat agent-artifacts/spec-kit/CONVENTIONS.md    2>/dev/null || true
cat agent-artifacts/spec-kit/TESTING.md        2>/dev/null || true
cat agent-artifacts/spec-kit/TECH_DEBT.md      2>/dev/null || true
```

Extract and hold in mind:
- The target architecture pattern (MVVM / Clean+MVI / Clean)
- The dependency rule (which layer may import which)
- Banned patterns (e.g. `!!`, `GlobalScope`, `LiveData`, direct DataSource calls from ViewModel)
- DI framework in use (Hilt / Koin / Manual)
- Coverage targets per layer
- Any known tech debt areas — changes touching these need extra scrutiny

---

### Phase 4 — Architecture Review

Using the diff from Phase 2 and the ADRs from Phase 3, assess the overall design.

Check:
- [ ] **Dependency rule respected** — no layer imports from a layer above it
- [ ] **New classes placed in the correct layer package**
- [ ] **No business logic in the UI layer** (Composables, Fragments, Activities)
- [ ] **No Android framework types in ViewModel** (`Context`, `View`, `FragmentManager`, `Resources`)
- [ ] **Repository / UseCase boundary honoured** — ViewModel does not call DataSource directly
- [ ] **New patterns consistent with existing code** — a new screen should look like existing screens
- [ ] **ADR compliance** — any decision that contradicts an ADR must be flagged as Critical

**For Bug Fix PRs additionally check:**
- [ ] The fix is applied at the correct layer — not patched in the UI when the bug is in the domain layer

**For Refactor PRs additionally check:**
- [ ] The refactor moves code *toward* the target architecture, not away from it

---

### Phase 5 — Conventions & Code Quality

Review against the project's CONVENTIONS.md. If that file doesn't exist, use the
Android defaults below. Project-specific rules always override defaults.

**Kotlin defaults:**
- [ ] No `!!` null assertions — use `?.let {}`, `?: return`, or `requireNotNull()`
- [ ] No `lateinit var` except `@Inject`-ed fields
- [ ] `val` preferred over `var`
- [ ] `data class` used for state/model types; no `var` fields in data classes
- [ ] Every `when` on a sealed class/interface is exhaustive — no `else` on sealed types
- [ ] No `GlobalScope` — all coroutines launched from `viewModelScope` or a scoped coroutine context
- [ ] No `runBlocking` in production code
- [ ] IO operations use `Dispatchers.IO`, CPU-bound work uses `Dispatchers.Default`
- [ ] No anonymous inner classes that capture Activity/Fragment context (leak risk)
- [ ] Extension functions in a dedicated `[Subject]Extensions.kt` file
- [ ] Named arguments when calling functions with 3+ params of the same type

**StateFlow / UI state:**
- [ ] UI state exposed as `StateFlow<UiState>` — not `LiveData`, not mutable
- [ ] `_state` private `MutableStateFlow`, `state` public `StateFlow`
- [ ] One-shot events (navigation, toasts) via `SharedFlow`, not part of `UiState`

**Compose:**
- [ ] Composables are stateless — state hoisted to ViewModel or caller
- [ ] No `ViewModel` instantiation inside a Composable (use `hiltViewModel()` or param)
- [ ] No `Flow.collectAsState` inside composition without `remember`
- [ ] No hardcoded hex colours — use MaterialTheme tokens
- [ ] No hardcoded strings — use `stringResource()`
- [ ] No magic numbers — extract to named constants

**Dependency injection:**
- [ ] No manual `object` singletons for injectable types
- [ ] No `new`/direct instantiation of classes that are `@Inject`-annotated
- [ ] New dependencies declared in a `@Module`, not in the class under injection

---

### Phase 6 — Test Coverage

```bash
# List test files changed or added in this PR
git diff --name-only origin/<base-branch>...HEAD | grep -E '(Test|Spec)\.kt$'

# List production files changed — every new class/function should have a test
git diff --name-only origin/<base-branch>...HEAD | grep -v Test | grep '\.kt$'
```

Check:
- [ ] **Every new public function in ViewModel / UseCase / Repository has a unit test**
- [ ] **New UI state transitions are tested** (success, loading, error paths)
- [ ] **Tests use the project's approved mocking library** (MockK or Mockito — per TESTING.md)
- [ ] **Flow/StateFlow tested with Turbine** (if in use) — no `Thread.sleep` or `delay` in tests
- [ ] **Test function names follow the convention**: `given_<state>_when_<action>_then_<outcome>` or equivalent
- [ ] **No `@Ignore`-d tests without a linked ticket**
- [ ] **No flaky patterns**: no `runBlocking` in test bodies where `runTest` applies

If a production file was changed but no test file exists and no test file was added:
flag as a Major finding.

---

### Phase 7 — Security Scan

```bash
# Check for common secret patterns in the diff
git diff origin/<base-branch>...HEAD | grep -iE \
  '(api_?key|secret|password|token|bearer|auth)[[:space:]]*[=:][[:space:]]*["\x27][^"\x27]{8,}' \
  || true

# Check for logging of potentially sensitive data
git diff origin/<base-branch>...HEAD | grep -iE \
  'Log\.(d|i|v|w|e)\(.*\b(password|token|secret|email|phone|ssn|credit)' \
  || true
```

Check:
- [ ] No hardcoded API keys, secrets, tokens, or passwords in any file
- [ ] No logging of PII or authentication data
- [ ] No `BuildConfig` fields that embed production secrets
- [ ] No `http://` URLs in production code (must be `https://`)
- [ ] No `setJavaScriptEnabled(true)` without documented justification
- [ ] Sensitive data not written to `SharedPreferences` unencrypted

⚠️ If a secret is found: **report it as Critical, do not print the secret value**.
State the file and line number only. Remediation is for the developer, not the agent.

---

### Phase 8 — Holistic Assessment

Step back from individual findings. Consider the PR as a whole through the lens of its type.

**All types:**
- **Is the PR the right size?** > ~500 lines of production code change is a risk.
- **Does the commit history tell a coherent story?** "WIP", "fix", "oops" commits should be flagged.
- **Does it introduce new tech debt?** If yes, is there a ticket for it?

**Feature:**
- Is anything missing that would make the feature incomplete from a user perspective?
- Is there updated documentation or a MODULE_MAP entry for the new screen/flow?

**Bug Fix:**
- Is there clear evidence in the diff that the root cause is addressed?
- Would a code reviewer be able to trace from the bug symptom → root cause → fix without guessing?

**Refactor:**
- Does the change leave the codebase in a better state, or does it just move complexity?
- Are there better idiomatic approaches that were missed?

**Hotfix:**
- Could this fix introduce a regression elsewhere? Flag if the change touches shared utilities.
- Is there a follow-up ticket to do a proper fix if this is a temporary patch?

---

## Output Format

Produce the review in this exact structure. Be specific — every finding must include
the file name and line reference from the diff.

```
## PR Review — <branch-name> → <base-branch>

**Type**: Feature / Bug Fix / Refactor / Task / Hotfix  |  **Ticket**: <ticket-id or None>
**Commits**: <n>  |  **Files changed**: <n>  |  **Lines**: +<n> / -<n>

### What this PR does
<2-3 sentences. Your understanding of the intent, type, and approach.>

### Verdict
✅ Approve  /  ⚠️ Approve with minor fixes  /  🟡 Request changes  /  🔴 Block

<One sentence justification for the verdict.>

---

### Architecture
<Pass / concern / violation — with reasoning tied to the project's ADRs>

---

### Findings

#### 🔴 Critical — must fix before merge
<!-- Blocks merge. Security issues, ADR violations, data loss risk. -->
- **[FileName.kt:line]** <finding> — <why it matters> <suggested fix>

#### 🟡 Major — should fix
<!-- Does not block but degrades quality, testability, or consistency. -->
- **[FileName.kt:line]** <finding> — <why it matters>

#### 🔵 Minor / Suggestion
<!-- Style, readability, idiomatic Kotlin, better approach. Non-blocking. -->
- **[FileName.kt:line]** <finding>

---

### Test Coverage
<Summary: adequate / gaps found. List specific untested cases if gaps exist.>

---

### Security
<Clean / issues found. File + line only — no secret values.>

---

### What's done well
<!-- Always include. Specific, genuine. Helps the author know what to keep. -->
- ...

### Questions for the author
<!-- Genuine questions, not disguised criticism. -->
- ...

### Commit quality
<Atomic and clear / issues: list problematic commit messages>
```

---

## Behaviour Rules

- **Never approve a PR with a Critical finding.**
- **Never print secret or credential values** — file and line only.
- **Never suggest rewriting the whole PR** — work with what's there.
- **Never be vague** — every finding needs a file reference.
- **Do not repeat the same finding multiple times** — consolidate.
- **Positives are mandatory** — a review with only negatives is not a good review.
- **Findings must reference the diff, not hypotheticals** — only flag what is
  actually in the changed code, not what could theoretically go wrong.
- **PR type drives severity** — a missing regression test on a Bug Fix is Critical;
  the same gap on a Refactor is Major. Apply proportionate judgement.
