# Wizard Engine — Quick Reference

A cheat sheet for common tasks when modifying the SDD wizard engine.

---

## Adding Framework Detection

### Android (Gradle)

**I want to detect when a project uses [Framework]:**

1. Find the dependency name in `build.gradle` (e.g., `hilt-android`, `retrofit`)
2. Open `engine/platform-android.js`, find `analyzeProject()` (line 310)
3. Add to the appropriate section:

```javascript
const uiMode = has('androidx.compose', 'compose-bom') ? 'Compose' : 'XML';
// ↑ Use has() with comma-separated keywords (OR logic)
```

4. Wire to the form:
```javascript
selectPill('pill-id', 'Label', 'radio');  // radio for single-select
// or
selectPill('pill-id', 'Label');            // multiple-select
```

5. Document in `docs/ENGINE_ARCHITECTURE.md` under "Dependency Detection Signals"

---

### iOS (SPM / Pods / Source)

**I want to detect when a project uses [Framework]:**

1. Determine the signal source:
   - **SPM import:** Add to `hasImp()` check → looks for `import FrameworkName` in Package.swift
   - **Pods name:** Add to `hasSrc()` check → substring match in Podfile text
   - **Source pattern:** Add to `hasPat()` check → pattern detected in scanned `.swift` files

2. Open `engine/platform-ios.js`, find `analyzeProject()` (line 290)

3. Add detection:
```javascript
const hasImp = lib => swiftImports.has(lib);      // SPM/source imports
const hasSrc = (...terms) => terms.some(t => src.includes(t.toLowerCase()));  // Podfile/Package.swift
const hasPat = pat => swiftPatterns.includes(pat); // Source code patterns

// Usage:
if (hasImp('Kingfisher')) selectPill('img-lib', 'Kingfisher', 'radio');
if (hasSrc('kingfisher')) selectPill('img-lib', 'Kingfisher', 'radio');
if (hasPat('asyncawait')) selectPill('async', 'Async/Await');
```

4. Document in `docs/ENGINE_ARCHITECTURE.md` under "Dependency Detection Signals"

---

## Adding a Form Field to Project Config

### Android

1. **Add HTML input** to `buildProjectConfigScreen()` in `platform-android.js`:
```javascript
<div class="form-row">
  <label>Your Label</label>
  <input type="text" id="cfg-fieldname" 
    placeholder="e.g. com.example.app"
    oninput="updatePreview('projectconfig'); saveDraft()">
</div>
```

2. **Auto-populate from Gradle** in `analyzeProject()`:
```javascript
// Extract from gradle
const value = appGradle.match(/your-regex/)?.[1];
// Apply to form
const el = document.getElementById('cfg-fieldname');
if (el && !el.value) el.value = value;
```

3. **Include in MD generation** — find `generateProjectConfigMD()` and add:
```javascript
const fieldname = document.getElementById('cfg-fieldname')?.value.trim() ?? '';
if (fieldname) md += `fieldname: ${fieldname}\n`;
```

4. **Add to draft persistence** — `restoreDraft()` auto-handles `id` attributes

---

### iOS

Same process, but use `platform-ios.js` and look for bundle ID / configuration parsing sections.

---

## Fixing Module Detection

### Problem: Wizard can't find the app module

**Android fix:**

The wizard tries `app/` first, then scans `settings.gradle` for other modules:

```javascript
// In analyzeProject()
let appGradle = await tryReadFile(state.dirHandle, 'app', 'build.gradle')
             ?? await tryReadFile(state.dirHandle, 'app', 'build.gradle.kts');

if (!appGradle && settings) {
  const moduleNames = [...settings.matchAll(/include\s*['"]:?([\w\-]+)['"]/g)]
    .map(m => m[1]);
  for (const mod of moduleNames) {
    const candidate = await tryReadFile(state.dirHandle, mod, 'build.gradle') 
                   ?? await tryReadFile(state.dirHandle, mod, 'build.gradle.kts');
    if (candidate && /com\.android\.application/.test(candidate)) {
      appGradle = candidate;
      break;
    }
  }
}
```

If this still fails:
- Check that `settings.gradle` has correct `include` directives
- Verify the app module is actually `com.android.application` (not a library)

---

## Debugging Detection

1. **Check browser console** — open DevTools (F12), read warnings/errors
2. **Verify file reads** — add `console.log()` after each `tryReadFile()`:
   ```javascript
   const file = await tryReadFile(...);
   console.log('Read file:', file ? file.slice(0, 100) : 'NOT FOUND');
   ```
3. **Check form state** — inspect the generated form values, verify `selectedPill()` worked
4. **Check preview** — does the MD preview reflect detected values?

---

## Key Functions by Task

| Task | Function | File |
|------|----------|------|
| Read a file from the selected folder | `tryReadFile(handle, ...parts)` | wizard-core.js |
| Pre-fill a text field | `document.getElementById(id).value = ...` | platform-*.js |
| Select a pill (checkbox/radio) | `selectPill(id, value, 'radio' \| '')` | wizard-core.js |
| Update form preview | `updatePreview(stepId)` | wizard-core.js |
| Save draft to localStorage | `saveDraft()` | wizard-core.js |
| Detect existing output files | `detectExistingOutputFiles(handle)` | wizard-core.js |

---

## File Organization Recap

```
agent-sdd/
├── setup-wizard.html                ← Main HTML, loads scripts
├── engine/
│   ├── wizard-core.js               ← Platform-agnostic logic
│   ├── platform-android.js          ← Android detection + Android forms
│   ├── platform-ios.js              ← iOS detection + iOS forms
│   └── [platform-newos.js]          ← Add new platforms here
├── docs/
│   ├── ENGINE_ARCHITECTURE.md       ← Full technical reference (this one)
│   └── QUICK_REFERENCE.md           ← Quick checklist (you are here)
└── [other files]
```

---

## Common Regex Patterns

### Gradle (Android)
```javascript
// applicationId
const match = gradle.match(/\bapplicationId\b\s*=?\s*["']([^"']+)["']/);
const appId = match ? match[1] : '';

// minSdk / targetSdk
const minMatch = gradle.match(/\bminSdk(?:Version)?\b\s*=?\s*(\d+)/);
const minSdk = minMatch ? minMatch[1] : '';

// Module names in settings.gradle
const modules = [...gradle.matchAll(/include\s*['"]:?([\w\-]+)['"]/g)]
  .map(m => m[1]);

// Dependency substring (case-insensitive)
const has = (...terms) => {
  const text = gradle.toLowerCase();
  return terms.some(t => text.includes(t.toLowerCase()));
};
```

### Xcode (iOS)
```javascript
// Bundle ID from pbxproj
const match = text.match(/PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^\s$(\n;]+)\s*;/);
const bundleId = match ? match[1].trim() : '';

// Build configuration name
const nameMatch = text.match(/\bname\s*=\s*"?([^";\n]+)"?\s*;/);
const configName = nameMatch ? nameMatch[1].trim() : '';

// Import statement from .swift source
const imports = [...text.matchAll(/^import\s+(\w+)/gm)]
  .map(m => m[1]);
```

---

## When Things Go Wrong

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Form fields not pre-filled | `analyzeProject()` not called or early return | Check that platform's `onFolderGranted()` is wired |
| Blank preview panel | `updatePreview()` not called | Add `updatePreview(stepId)` after form updates |
| Module detection wrong | Gradle files not read OR regex mismatches | Check file read warnings in console, test regex on actual build.gradle |
| Old values persist after re-selecting folder | Draft localStorage not cleared | Reopen wizard in fresh browser tab or clear localStorage |
| iOS bundle ID shows `(none)` | pbxproj / xcconfig not found OR parsing failed | Check that app has build configurations, verify xcconfig file exists |

---

## Code Review Checklist

When reviewing platform changes:

- [ ] All regex patterns are tested on both Groovy and Kotlin DSL (Android) / SPM and Pods (iOS)
- [ ] Fallbacks are in place (e.g., try XML, then Kotlin DSL)
- [ ] `updatePreview()` is called after form updates
- [ ] `saveDraft()` is called for user-editable fields
- [ ] Dependency signals are case-insensitive
- [ ] Console has no error/warning messages
- [ ] MD preview reflects detected values correctly
- [ ] Multi-module projects are tested
- [ ] Documentation is updated if signals changed

---

## Further Reading

- `ENGINE_ARCHITECTURE.md` — Full technical deep dive
- `setup-wizard.html` — HTML structure and CSS
- `README.md` — Project overview
