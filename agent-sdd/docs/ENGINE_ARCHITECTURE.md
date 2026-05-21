# Wizard Engine Architecture

A reference guide for understanding how the SDD setup wizard auto-detects project configuration from source files. Use this when modifying platform detection, adding new framework signals, or extending the wizard for new platforms.

---

## Overview

The wizard engine consists of three parts:

1. **`wizard-core.js`** — Platform-agnostic UI, state management, file I/O, sidebar rendering
2. **`platform-android.js`** — Android-specific detection, Gradle parsing, form pre-fill
3. **`platform-ios.js`** — iOS-specific detection, Xcode/CocoaPods/SPM parsing, form pre-fill

Each platform file exports a `PLATFORM` object with:
- `id`, `name` — Platform identifier and display name
- `steps` — Full list of wizard steps (welcome through done)
- `buildScreens` — Form renderers for each step
- `onFolderGranted()` — Callback that runs `analyzeProject()` when a folder is selected
- `taskDefaults` — Quality gate defaults for the Task screen

---

## Android Platform Detection

### Files Read (in order of priority)

#### 1. Root-level Gradle files (parallel read)
```
build.gradle        OR  build.gradle.kts
settings.gradle     OR  settings.gradle.kts
```

**Purpose:**
- Detect dependency names (case-insensitive substring search in combined text)
- Extract module names from `settings.gradle` to locate the app module
- Used as fallback if no files exist below

**Why parallel:** These files are small (<50KB typically) and provide complementary data without dependency.

---

#### 2. App module's build.gradle (Groovy or Kotlin DSL)
```
app/build.gradle  OR  app/build.gradle.kts
```

If `app/` doesn't exist, `analyzeProject()` parses `settings.gradle` for all `include` directives and tries each module until it finds one with `com.android.application` in the Gradle text.

**What gets extracted:**

| Pattern | Extracted field | Example |
|---------|-----------------|---------|
| `applicationId = "..."` | Base package name | `com.example.app` |
| `minSdk = N` or `minSdkVersion = N` | Min API level | `24` |
| `targetSdk = N` or `targetSdkVersion = N` | Target API level | `34` |
| `productFlavors { ... }` | Build variants | `development`, `staging`, `production` |

**Special parsing: productFlavors**

The wizard uses **brace-counting** (not lazy regex) to extract the full `productFlavors { }` block:

```kotlin
productFlavors {
  development {
    applicationIdSuffix = ".dev"
  }
  staging {
    applicationIdSuffix = ".staging"
  }
}
```

For each inner flavor block, extract:
- Flavor name: `development`, `staging`, `production`
- `applicationIdSuffix` (if present) → append to base `applicationId`
- `applicationId` (if directly specified) → use as-is

This is necessary because simple regex like `/productFlavors.*\}` stops at the **first `}`**, which is the closing brace of the innermost flavor block, not the outer `productFlavors` block.

**Code location:** `platform-android.js` lines 373–403

---

#### 3. Per-module build.gradle files (parallel read, one per Gradle module)

After extracting module names from `settings.gradle`, read each module's `build.gradle`:
```
:<module>/build.gradle  OR  :<module>/build.gradle.kts
```

**What gets extracted:**

| Pattern | Used for |
|---------|----------|
| `com.android.application` | Module type = "Single Activity" |
| `com.android.library` | Module type = "MVVM" or "Repository" (guessed from name) |
| `hilt-android` or `dagger.hilt` | DI column in Module Map |
| Module name pattern | Module purpose (e.g., `:feature-*` → "Feature module") |

---

### Dependency Detection Signals

All signals are **case-insensitive substring searches** across the combined root + app Gradle files.

#### Language
```
Source file count (Kotlin, Java) → selectPill('cfg-lang', 'Kotlin' | 'Java' | 'Kotlin+Java')
```
Files are counted by walking the source tree: `countSourceFiles(dirHandle, maxDepth=4)` counts `*.kt` and `*.java` files, skipping `build/`, `.gradle/`, `.git/`, `node_modules/`.

#### Dependency Injection
```
'hilt-android' or 'dagger.hilt'         → Hilt
'com.google.dagger' (without hilt)      → Dagger
'insert-koin' or 'koin-android'         → Koin
(none)                                  → (blank)
```

#### UI Framework
```
'androidx.compose' or 'compose-bom' or 'compose-ui'      → Compose (pure) or Mixed
'appcompat' AND 'constraintlayout' AND 'recyclerview'    → XML
```

#### Navigation
```
'navigation-compose'                    → ComposeNav
'navigation-fragment' AND 'navigation-ui' → JetpackNav
```

#### Async/Concurrency
```
'kotlinx-coroutines'                    → Coroutines + StateFlow
'rxjava:2' or 'rxandroid:2'             → RxJava2
'rxjava3' or 'rxandroid:3'              → RxJava3
'lifecycle-livedata' or 'livedata-ktx'  → LiveData (toggle in Migrations)
```

#### Network
```
'retrofit'  → Retrofit
'okhttp'    → OkHttp
'io.ktor'   → Ktor
'volley'    → Volley
```

#### Storage
```
'room-runtime' or 'room-ktx' or 'androidx.room'  → Room
'datastore'                                      → DataStore
'realm'                                          → Realm
```

#### Image Loading
```
'io.coil-kt' or 'coil-kt' or '"coil"'  → Coil
'squareup.picasso'                     → Picasso
'bumptech.glide' or '"glide"'          → Glide
```

#### Testing
```
'junit.jupiter' or 'junit5' or 'junit-platform'           → JUnit 5
'mockk'                                                   → MockK
'mockito'                                                 → Mockito
'turbine'                                                 → Turbine (Flow testing)
'truth'                                                   → Truth (assertions)
'assertj'                                                 → AssertJ (assertions)
'espresso'                                                → Espresso
'ui-test-junit4' or 'compose.ui.test'                    → Compose UI Test
```

#### Migrations (Legacy patterns to track)
```
'lifecycle-livedata' or 'livedata-ktx'  → setToggle('mig-livedata', true)
'rxjava2' or 'rxjava3'                  → setToggle('mig-rxjava', true)
Java source files present               → setToggle('mig-java', true)
```

---

### Data Flow: Gradle → Form

1. **`analyzeProject()`** is called when folder is selected (via `PLATFORM.onFolderGranted()`)
2. Read Gradle files (lines 315–337)
3. Perform dependency checks (lines 348–459)
4. **Apply to project config form** (lines 406–417) — `getElementById` + `selectPill()`
5. **Apply to architecture pills** (lines 420–445)
6. **Apply to testing dropdowns** (lines 448–452)
7. **Apply to migration toggles** (lines 455–458)
8. **Detect modules & module details** (lines 461–519)
9. Call `updatePreview()` to refresh MD preview
10. Show toast when complete

---

## iOS Platform Detection

### Files Read (in order of dependency)

#### 1. Locate `.xcodeproj` directory
```javascript
// Scan project root for *.xcodeproj (may be nested)
for (const [name, handle] of dirHandle) {
  if (handle.kind === 'directory' && name.endsWith('.xcodeproj')) {
    xcodeprojDirName = name;  // e.g., "MyApp.xcodeproj"
  }
}
```

**Why:** Xcode projects can be nested. Using the found handle ensures we read the right `project.pbxproj`.

---

#### 2. Dependency manifest files (parallel read)
```
Package.swift   (SPM)
Podfile         (CocoaPods)
<App>.xcodeproj/project.pbxproj  (Xcode config)
```

**Purpose:**
- `Package.swift` → SPM dependency names
- `Podfile` → CocoaPods dependency names
- `project.pbxproj` → Build configurations, bundle IDs, schemes

**Why parallel:** Independent sources; reading in parallel is faster than sequential.

---

#### 3. Swift source files (recursive scan, depth 5)
```
Scan all .swift files (up to 40 files sampled)
Skip: .build/, .git/, node_modules/, DerivedData/, Pods/, build/, .swiftpm/
```

**Pattern detection via source code inspection:**

| Pattern in source | Detected flag |
|------------------|--------------|
| `import Combine` | `combine` |
| `@StateObject` OR `@ObservedObject` | `stateobject` |
| `@Observable` | `observable` |
| `ObservableObject` | `observableobject` |
| `UIViewController` OR `: UIView` | `uikit` |
| `: View` OR `some View` | `swiftui` |
| `async ` OR `await ` | `asyncawait` |
| `AnyPublisher` OR `@Published` | `combine` |
| `NavigationStack` | `navstack` |
| `Coordinator` | `coordinator` |

Also count `*.m` / `*.mm` files for Objective-C presence.

---

#### 4. Parse project.pbxproj for build configurations

The `project.pbxproj` file contains XML-like sections. For each `isa = XCBuildConfiguration;` block:

```
isa = XCBuildConfiguration;
  buildSettings = {
    PRODUCT_BUNDLE_IDENTIFIER = com.example.app;
    ...
  };
  name = Release;
```

Extract:
- `PRODUCT_BUNDLE_IDENTIFIER` (or `BUNDLE_ID` variable reference)
- Configuration name (`Release`, `Debug`, `AppStore`, etc.)

Store in `configBundleMap[configName] = bundleId`

**Note:** If pbxproj uses variable references like `$(BUNDLE_ID)` or `$BUNDLE_ID`, skip and fall through to xcconfig scan.

**Code location:** `platform-ios.js` lines 352–375

---

#### 5. Scan .xcconfig files (recursive, depth 6)

Many iOS projects externalize build settings to `.xcconfig` files and reference them in Xcode. This scan catches those:

```
BUNDLE_ID = com.example.app
PRODUCT_BUNDLE_IDENTIFIER = com.example.app.staging
```

For each `.xcconfig` file found:
- Extract `BUNDLE_ID` or `PRODUCT_BUNDLE_IDENTIFIER` line
- Store in `configBundleMap`

**Code location:** `platform-ios.js` lines 377–401

---

#### 6. Resolve main bundle ID

After both pbxproj and xcconfig scans, choose the bundle ID in this priority order:

```javascript
mainBundleId = configBundleMap['AppStore']
    || configBundleMap['AppStore-Release']
    || configBundleMap['Release']
    || (first non-dev ID)
    || (first ID if all are dev)
    || '';
```

This ensures production bundle ID is preferred over debug/staging variants.

---

### Dependency Detection Signals

All signals are **case-insensitive substring searches** across `Package.swift` + `Podfile` combined text, PLUS direct import statements found in Swift source code.

#### Language
```
Source file count:
  Swift files > 0 AND Objective-C files > 0  → Swift+ObjC
  Swift files > 0                            → Swift
  Objective-C files > 0                      → Objective-C
```

#### State Management (from source + dependencies)
```
hasImp('Combine') OR hasPat('combine')       → Combine
hasPat('observable')                          → Observation (@Observable, iOS 17+)
hasPat('observableobject') OR hasImp('Combine') → ObservableObject
hasPat('stateobject') OR hasImp('Combine')   → @StateObject
```

#### UI Framework
```
hasPat('swiftui')                    → SwiftUI
hasPat('uikit')                      → UIKit
(both present)                       → Mixed
```

#### Navigation
```
hasPat('navstack')                   → NavigationStack (SwiftUI, iOS 16+)
hasPat('coordinator')                → Coordinator pattern
hasSrc('swiftui-nav', 'Navigating')  → (other SwiftUI nav patterns)
```

#### Architecture Pattern
```
hasPat('coordinator')                → Coordinator
hasImp('ComposableArchitecture') OR hasSrc('TCA') → TCA (The Composable Architecture)
(none detected)                      → (blank — user selects manually)
```

#### Async/Concurrency
```
hasPat('asyncawait')                 → Async/Await (Swift 5.5+)
hasPat('combine')                    → Combine (reactive, pre-Async/Await)
```

#### Networking
```
hasImp('Alamofire')                  → Alamofire
hasSrc('URLSession')                 → URLSession (native)
hasImp('Moya')                       → Moya (Alamofire wrapper)
```

#### Image Loading
```
hasImp('Kingfisher')                 → Kingfisher
hasImp('SDWebImage')                 → SDWebImage
hasImp('Nuke')                       → Nuke
```

#### Dependency Injection
```
hasImp('Swinject')                   → Swinject
hasImp('Container')                  → (native container pattern — rare)
(none detected)                      → (blank — user selects manually)
```

#### Testing
```
hasImp('XCTest')                     → (native, always present)
hasImp('Quick') OR hasImp('Nimble')  → Quick + Nimble (BDD-style)
hasImp('Mockito') OR hasImp('Mock')  → (depends on dependency name)
```

---

## Common Patterns & Gotchas

### Gradle Multi-Module Projects

**Problem:** The wizard hardcodes `app/` as the app module location. But some projects use custom names like `android_app/`, `NomNomStock/`, etc.

**Solution:** After checking `app/`, parse `settings.gradle` for all `include` directives and search each module for `com.android.application`:

```kotlin
const moduleNames = [...settings.matchAll(/include\s*['"]:?([\w\-]+)['"]/g)]
  .map(m => m[1]);
for (const mod of moduleNames) {
  if (mod === 'app') continue;
  const candidate = await tryReadFile(state.dirHandle, mod, 'build.gradle')
    ?? await tryReadFile(state.dirHandle, mod, 'build.gradle.kts');
  if (candidate && /com\.android\.application/.test(candidate)) {
    appGradle = candidate;
    break;
  }
}
```

**Lesson:** Always have a fallback strategy when scanning project structures.

---

### iOS Bundle ID Ambiguity

**Problem:** `project.pbxproj` may contain multiple bundle IDs (app, watch extension, widget, test targets). Some projects use variable references and store real values in `.xcconfig` files.

**Solution:** Three-phase approach:

1. Parse `project.pbxproj` for direct `PRODUCT_BUNDLE_IDENTIFIER` values → `configBundleMap`
2. Scan `.xcconfig` files → merge into `configBundleMap`
3. Prefer production (AppStore, Release) over debug/staging

Filter out non-app bundle IDs:
```javascript
if (!/(test|widget|extension|watch|notification|clip)/i.test(bundleId))
  configBundleMap[cfgName] = bundleId;
```

**Lesson:** Multi-file, multi-phase detection increases accuracy but adds complexity. Document the priority order clearly.

---

### Kotlin DSL vs Groovy Syntax

Both Gradle and Swift build systems support multiple syntaxes:
- **Gradle:** `build.gradle` (Groovy) or `build.gradle.kts` (Kotlin DSL)
- **iOS:** Not applicable (always `.xcodeproj` XML), but Podfile has Ruby syntax

**Pattern differences:**

| Concept | Groovy | Kotlin DSL |
|---------|--------|-----------|
| Flavor block | `development { }` | `create("development") { }` |
| Property | `applicationId "..."` | `applicationId = "..."` |
| Semicolon | Optional | Required |

The wizard checks both syntaxes via fallback:
```javascript
tryReadFile(..., 'build.gradle')
  ?? tryReadFile(..., 'build.gradle.kts')
```

**Lesson:** Always support both syntaxes or document the limitation clearly.

---

## Extending for New Platforms

### Adding a New Platform

1. Create `engine/platform-newos.js`
2. Export a `PLATFORM` object with required fields:
   ```javascript
   const PLATFORM = {
     id: 'newos',
     name: 'NewOS',
     steps: [{ id: 'welcome', ... }, { id: 'projectconfig', ... }, ...],
     buildScreens: { projectconfig: ..., architecture: ..., ... },
     onFolderGranted: () => analyzeProject(),
     taskDefaults: { qualityGate: [...] },
   };
   ```
3. Implement `analyzeProject()` following the Android/iOS pattern:
   - Read key files (build config, dependency manifests, source files)
   - Extract project data via regex/parsing
   - Pre-fill form elements via `selectPill()`, `getElementById().value = ...`
   - Call `updatePreview()` when done
4. Update `setup-wizard.html` to reference the new platform in the overlay
5. Add platform choice to the overlay UI

### Adding Framework Detection

**For Android:**
1. Add a keyword to the appropriate list in `analyzeProject()` (lines 348–445)
2. Choose the right `.selectPill()` call or form field
3. Update the `has()` check if the dependency has multiple names
4. Document the signal in this file

**For iOS:**
1. Add to `hasImp()` check (looks for SPM/Pods imports) or `hasSrc()` check (looks in Package.swift/Podfile text)
2. Or add a new `hasPat()` check if you're scanning Swift source code for a specific pattern
3. Call `selectPill()` with the right framework name
4. Update the signals table in this file

### Adding a New Form Field

1. Add the input to the form HTML in the platform's `buildScreenScreen()` function
2. Give it an `id` like `cfg-fieldname`
3. In `analyzeProject()`, populate it:
   ```javascript
   const el = document.getElementById('cfg-fieldname');
   if (el && !el.value) el.value = detectedValue;
   ```
4. Add it to `restoreDraft()` if needed (localStorage for persistence)
5. Update the step's MD generator to read from this field

---

## File Organization

```
engine/
├── wizard-core.js           ← Platform-agnostic: state, UI, I/O, sidebar
├── platform-android.js      ← Android-specific detection & form builders
├── platform-ios.js          ← iOS-specific detection & form builders
└── [platform-newos.js]      ← New platforms go here
```

**Dependency graph:**
```
setup-wizard.html
  ↓
  engine/wizard-core.js       (platform-agnostic)
  ├─→ engine/platform-{name}.js (called via <script> tag after user selects platform)
  │    └─→ PLATFORM object (exported at end of file)
  └─→ PLATFORM.buildScreens.{step}() (renders forms)
      └─→ PLATFORM.analyzeProject() (detects & pre-fills)
```

---

## Performance Notes

- **Android:** Gradle file parsing is regex-based and fast. Per-module scanning is I/O-bound but uses `Promise.all()` for parallelism.
- **iOS:** Swift source file scan (up to 40 files) is the slowest operation. Limit recursion depth to avoid scanning Pods/ or DerivedData/.
- **General:** Always use `Promise.all()` for independent file reads to avoid sequential I/O waits.

---

## Testing Changes

After modifying detection logic:

1. **Test with a known project** that has the framework(s) you're detecting
2. **Test with a project that doesn't have them** — ensure no false positives
3. **Test with variant syntax** — both Groovy + Kotlin DSL (Android), both SPM + Pods (iOS)
4. **Test with multi-module projects** — ensure module detection works correctly
5. **Check the preview panel** — MD preview should reflect detected values correctly

---

## References

- [Gradle Build Files](https://docs.gradle.org/current/userguide/declaring_dependencies.html)
- [iOS Build Settings Reference](https://developer.apple.com/documentation/xcode/build-settings-reference)
- [Swift Package Manager](https://www.swift.org/package-manager/)
- [CocoaPods](https://cocoapods.org/)
