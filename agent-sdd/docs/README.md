# Wizard Engine Documentation

Reference guides for understanding and maintaining the SDD setup wizard's platform detection engine.

---

## 🚀 Start Here

**👉 Open `engine-guide.html` in your browser for the interactive guide** — it has tabs, navigation, and better formatting than markdown.

Or read the markdown files below for CLI/text editor use.

---

## Documents

### 1. **ENGINE_ARCHITECTURE.md** — Full Technical Reference
**For:** Engineers who need to understand how the wizard works, add new framework detection, or extend to new platforms.

**Covers:**
- Overall architecture (wizard-core.js + platform-specific files)
- **Android:** Which Gradle files are read, how dependencies are extracted, signal patterns
- **iOS:** How .xcodeproj, Podfile, Package.swift, and .xcconfig are parsed
- Common gotchas (multi-module projects, bundle ID ambiguity, syntax variants)
- Extending for new platforms and frameworks
- Performance considerations

**Length:** ~560 lines, detailed with code examples

---

### 2. **QUICK_REFERENCE.md** — Cheat Sheet for Common Tasks
**For:** Engineers making routine changes like adding framework detection or fixing bugs.

**Covers:**
- Step-by-step: Add framework detection for Android/iOS
- How to add a new form field
- Fixing module detection issues
- Debugging tips and common regex patterns
- Code review checklist
- Common problems and fixes

**Length:** ~350 lines, task-oriented

---

## When to Use Which

| Task | Use This |
|------|----------|
| "I need to detect if a project uses [Framework]" | QUICK_REFERENCE.md |
| "Why does module detection fail for non-standard names?" | ENGINE_ARCHITECTURE.md → "Gradle Multi-Module Projects" |
| "How does the wizard determine if the UI layer is Compose or XML?" | ENGINE_ARCHITECTURE.md → "Dependency Detection Signals" → UI Framework |
| "What file contains the iOS bundle ID?" | ENGINE_ARCHITECTURE.md → "iOS Platform Detection" → Files Read → pbxproj |
| "I need to add a new form field to Project Config" | QUICK_REFERENCE.md |
| "How can I extend the wizard for a new platform (e.g., Flutter, React Native)?" | ENGINE_ARCHITECTURE.md → "Extending for New Platforms" |
| "Tests are failing — where's the bug?" | QUICK_REFERENCE.md → "Debugging Detection" + ENGINE_ARCHITECTURE.md |

---

## Code Structure

```
wizard-core.js (1500+ lines)
├── State management (state, STEPS, draft persistence)
├── UI rendering (buildSidebar, goTo, init)
├── File I/O (tryReadFile, handleSave)
├── Form utilities (selectPill, pill rendering)
├── Existing output detection (detectExistingOutputFiles)
├── Companion polling (pollCompanion, setCompanionStatus)
├── Folder selection (grantFolder, showFolderInterstitial)
└── Utilities (showToast, updatePreview)

platform-android.js (3200+ lines)
├── PLATFORM object definition
├── analyzeProject() ← Entry point for Android detection
│   ├── Read Gradle files
│   ├── Extract package, SDK levels, variants
│   ├── Dependency detection (DI, UI, async, testing, etc.)
│   ├── Module detection & analysis
│   └── Pre-fill all form fields
├── buildScreens (one function per wizard step)
│   ├── buildProjectConfigScreen
│   ├── buildArchitectureScreen
│   ├── buildConventionsScreen
│   └── ... (8 screens total)
└── Helpers (scanForInterceptors, countSourceFiles, etc.)

platform-ios.js (2900+ lines)
├── PLATFORM object definition
├── analyzeProject() ← Entry point for iOS detection
│   ├── Locate .xcodeproj directory
│   ├── Read Package.swift, Podfile, project.pbxproj
│   ├── Scan .swift source files for patterns
│   ├── Parse pbxproj for bundle IDs
│   ├── Scan .xcconfig files
│   ├── Resolve main bundle ID
│   ├── Dependency detection (SPM, Pods, source patterns)
│   └── Pre-fill all form fields
├── buildScreens (one function per wizard step)
└── Helpers (pattern detection utilities)
```

---

## Key Concepts

### Dependency Detection

**Android:** Uses Gradle text parsing with case-insensitive substring matching. Example:
```javascript
const has = (...terms) => terms.some(t => gradle.includes(t.toLowerCase()));
if (has('androidx.compose')) selectPill('ui', 'Compose');
```

**iOS:** Three-pronged approach:
1. **Import statements** — direct `import` lines in Swift source code
2. **Manifest files** — dependency names in Package.swift or Podfile
3. **Source patterns** — regex on actual .swift files for framework-specific code

### Brace Counting (Android)

Simple regex like `/productFlavors.*\}/` fails because it stops at the **first `}`** (the flavor block), not the outer `productFlavors` block. Solution: count braces manually.

```javascript
// Navigate through the string, counting { and }
let depth = 0;
for (let i = openAt; i < text.length; i++) {
  if (text[i] === '{') depth++;
  else if (text[i] === '}') {
    depth--;
    if (depth === 0) { /* found the closing brace */ }
  }
}
```

### Pre-filling Forms

Three techniques:

1. **Direct field assignment:**
   ```javascript
   document.getElementById('cfg-min-sdk').value = '24';
   ```

2. **Pill selection (radio/checkbox):**
   ```javascript
   selectPill('cfg-lang', 'Kotlin', 'radio');
   ```

3. **Dropdown selection:**
   ```javascript
   setSelectOption('test-runner', 'JUnit 5');
   ```

---

## File Read Flow

All file reads use the `tryReadFile(dirHandle, ...parts)` helper:

```javascript
// These all work:
tryReadFile(handle, 'build.gradle')                    // root file
tryReadFile(handle, 'app', 'build.gradle')             // nested
tryReadFile(handle, 'android', 'app', 'build.gradle')  // deeply nested
// Returns file text if found, null if not (silent fallback)
```

Reads are **asynchronous** and use `Promise.all()` for parallel I/O:

```javascript
const [gradle, settings] = await Promise.all([
  tryReadFile(handle, 'build.gradle'),
  tryReadFile(handle, 'settings.gradle'),
]);
```

---

## Testing Your Changes

1. **Local test:** Open `setup-wizard.html` in Chrome, select a real project folder
2. **Check console:** DevTools → Console tab for errors/warnings
3. **Inspect form state:** DevTools → Elements, check that `value` and `checked` attributes match detection
4. **Check preview:** Does the Markdown preview on the right show detected values?
5. **Test edge cases:**
   - Multi-module Android projects with non-standard names
   - iOS with variable references in pbxproj (xcconfig fallback)
   - Mixed Kotlin + Java code
   - Projects with multiple build configurations

---

## Common Files Structure by Platform

### Android Project
```
build.gradle          ← Root: dependency versions, plugins
settings.gradle       ← Module list: include ':feature-login', ':core:data'
app/build.gradle      ← App module: applicationId, productFlavors, minSdk, targetSdk
module/build.gradle   ← Library module: com.android.library, dependencies
```

### iOS Project
```
MyApp.xcodeproj/project.pbxproj  ← Build config, bundle IDs, schemes
Podfile                          ← CocoaPods dependencies
Package.swift                    ← SPM dependencies (optional)
Config.xcconfig                  ← Build settings variables
Sources/                         ← Swift source code (scanned for patterns)
```

---

## Troubleshooting

### Wizard can't find Gradle files
- Project is not Android, or build.gradle files are in non-standard location
- Check `analyzeProject()` — add logging to see which files are read

### Module detection fails
- `settings.gradle` has unexpected syntax (e.g., using variables)
- App module is not named `app/` and doesn't have `com.android.application`
- **Fix:** See ENGINE_ARCHITECTURE.md → "Gradle Multi-Module Projects"

### Form fields stay blank after folder selection
- File reads are failing (check Network tab in DevTools)
- Regex patterns don't match actual file content
- `updatePreview()` not called after form updates
- **Fix:** Add console logging after each `tryReadFile()`

### iOS bundle ID is wrong or missing
- pbxproj has variable references; xcconfig scan needs to find the actual values
- Bundle ID is filtered out (contains "test", "widget", "extension", etc.)
- **Fix:** See ENGINE_ARCHITECTURE.md → "iOS Bundle ID Ambiguity"

---

## Contributing a Fix

1. **Identify the issue** using one of the above docs
2. **Make the change** in `platform-android.js` or `platform-ios.js`
3. **Test locally** with the checklist above
4. **Update documentation** if the fix involves new signals or changed behavior
5. **Add to CHANGELOG** (if the project maintains one)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 2026 | Initial documentation for full Android + iOS detection engine |
| ... | ... | (track future changes here) |

---

## Questions?

- **How do I...?** → Check QUICK_REFERENCE.md
- **Why does the wizard...?** → Check ENGINE_ARCHITECTURE.md
- **Where's the code for...?** → Code Structure section above
