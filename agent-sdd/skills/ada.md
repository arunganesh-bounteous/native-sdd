# Skill: ada — Accessibility (a11y) Compliance
# ─────────────────────────────────────────────────────────────────────────────
# A plug-n-play skill module. It is ACTIVE only when a task's `Skills:` line lists
# `ada`. When active, apply the rules below ON TOP OF the normal Steps 0–8.
# Scope is limited to UI the task creates or modifies — do not retrofit the
# whole app. Read-only for the agent; humans edit this in agent-sdd/skills/.
# ─────────────────────────────────────────────────────────────────────────────

## When this skill is active

The ticket touches user-facing UI and must meet accessibility standards. Apply these
checks to every screen, view, or component you **create or modify** — not to code you
only read.

If the project's `spec-kit/CONVENTIONS.md` defines accessibility rules, those take
precedence over the defaults here.

## What it adds to your workflow

- **Step 3 (Understanding):** add a line `**Accessibility (ada):** active — <screens/views in scope>`.
- **Step 5 (Execute):** build accessibility in as you write the UI — do not bolt it on after.
- **Step 6 (Self-Verification):** run the Accessibility Gate below in addition to the normal quality gate.
- **Step 8 (Completion report):** add an `### Accessibility (ada)` section listing what you verified and what needs manual review.

## Accessibility Gate

Scan every UI file you created or modified.

**Android**

| Check | Rule |
|-------|------|
| Content labels | Every actionable / informative view has a `contentDescription` (or `contentDescription = null` for purely decorative images). Compose: `Modifier.semantics` / `contentDescription`. |
| Touch targets | Interactive targets are at least `48dp × 48dp` (`minWidth`/`minHeight` or `Modifier.sizeIn`). |
| Text scaling | Text sizes use `sp`, not `dp`; layouts do not hard-code heights that clip scaled text. |
| Color is not the only signal | State/meaning conveyed by color also has text, icon, or shape. |
| Focus & order | Screen-reader (TalkBack) focus order is logical; related controls grouped. |
| Labels not redundant | No "button"/"image" baked into the label — the role announces that. |

**iOS**

| Check | Rule |
|-------|------|
| Labels | Every control has a meaningful `accessibilityLabel`; decorative images are hidden via `accessibilityHidden(true)`. |
| Dynamic Type | Text uses scalable styles (`.font(.body)` / `UIFontMetrics`), not fixed point sizes. |
| Touch targets | Tappable targets are at least `44pt × 44pt`. |
| Color is not the only signal | Meaning conveyed by color also has text/icon/shape. |
| Traits | Controls expose correct `accessibilityTraits` (`.button`, `.header`, etc.). |
| VoiceOver order | Reading order is logical; related elements grouped with `accessibilityElement(children:)`. |

## Evidence & honesty rule

- Report each view you labeled and how (file:line).
- **Color contrast** usually cannot be measured from source alone. Do NOT claim a contrast
  pass you did not verify — list color/background pairs you introduced as
  `manual review needed — verify ≥ 4.5:1 (3:1 for large text)`.
- Anything you cannot confirm from code → flag for manual review rather than asserting pass.

## Completion report section

```
### Accessibility (ada)
- Labeled: [file:line — view → label]
- Touch targets verified: [file:line]
- Text scaling: [pass / issue]
- Manual review needed: [contrast pairs, anything not verifiable from source]
```
