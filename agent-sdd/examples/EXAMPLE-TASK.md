# Example Task — [PROJECT_NAME]-ENGAGE-OPT-IN
# ─────────────────────────────────────────────────────────────────────────────
# This is a reference example of a well-written task MD.
# It was written for a real project. Class names and endpoint paths are
# project-specific — replace them with your own when adapting this pattern.
# ─────────────────────────────────────────────────────────────────────────────

# Task: [PROJ]-ENGAGE-OPT-IN — Source email marketing opt-in from Engage API instead of Ordering API

## Type

- [x] Bug
- [ ] Feature
- [ ] Refactor
- [ ] Task

## Description

The app currently reads a guest's marketing opt-in/out status from the Olo Ordering API
(`getUserContactOptions` → `OloContactOptionsResponse.optin`). This reflects only the
checkbox state on a single transaction, not the guest's true consolidated preference.

Olo Engage (`/engage/getuser`) is the system of record for opt-in status. Guest-initiated
opt-outs via the client website flow correctly into Engage but are NOT reflected when
reading from the Ordering API.

Replace all reads of opt-in status from the Olo Ordering API with the `email_marketing_opt_in`
field from the existing `/engage/getuser` response (`GetUserEngageResponse.data.user.emailMarketingOptIn`).

No new endpoints needed. `OloEngageService.refreshUserData()` / `OloEngageManager.refreshEngageUserData()`
already call `/engage/getuser` and return `GetUserEngageResponse` which contains `emailMarketingOptIn`.

## Acceptance Criteria

- [ ] `AppSettingsFragment.switchPromotional` initial checked state is driven by
      `GetUserEngageResponse.data.user.emailMarketingOptIn` — NOT `OloContactOptionsResponse.optin`
- [ ] `AppProfileViewModel.loadContactOptions()` and `_contactOptions` StateFlow are no longer
      used to set the promotional switch state
- [ ] `AppProfileViewModel.updateContactOption(emailPref: Boolean)` updates opt-in via
      `/engage/updateuser` — NOT `userRepository.updateUserContactOptions()`
- [ ] `OloEngageRequestBody.Fields` is extended with `email_marketing_opt_in: Boolean` so the
      update call can carry the opt-in value
- [ ] `OloEngageManager.EngageUserData` (or equivalent) exposes `emailMarketingOptIn: Boolean`
      so the ViewModel can surface it to the UI
- [ ] `AppProfileViewModel.EngageUserData` is extended with `emailMarketingOptIn: Boolean = false`
- [ ] All existing Engage refresh paths (`refreshEngageUserData`, `getParsedEngageUserData`,
      `getAndParseEngageUserData`) propagate `emailMarketingOptIn` through to the caller

## Quality Gate

- [ ] No `!!` operators introduced
- [ ] No new `LiveData` — any new state uses `StateFlow`
- [ ] No hardcoded strings, colors, or dimensions
- [ ] All `when` on sealed types are exhaustive — no `else`
- [ ] No business logic in UI layer (AppSettingsFragment only observes, does not decide)
- [ ] `AppSettingsFragment` does not call `loadContactOptions()` or observe `_contactOptions`
      after this change — verify by grep

## Out of Scope

- Do NOT change `CheckoutSuccessViewModel.updateEmailSubscription()` — that is a different
  flow (guest account creation) and is out of scope for this ticket
- Do NOT remove `getUserContactOptions` / `updateUserContactOptions` from `AppUserRepository` —
  other callers may exist; removal is a separate cleanup ticket
- Do NOT change the update path for `emailreceipts`, `followups`, `upsell`, `marketingsms`
  in `ContactOptionsRequest` — only the opt-in read source changes
- Do NOT modify the Olo Ordering API networking layer
- Do NOT add SMS opt-in (`sms_marketing_opt_in`) to the UI — not in scope

## Affected Areas

settings, profile, opt-in, AppSettingsFragment, AppProfileViewModel, OloEngageManager,
OloEngageRequestBody, GetUserEngageResponse, EngageUserData, refreshEngageUserData

## Testing

Required: Y
Level: Unit

Scenarios:
- [ ] `AppProfileViewModel`: when `refreshEngageUserData` returns `emailMarketingOptIn = true`,
      `engageUserData.emailMarketingOptIn` is `true`
- [ ] `AppProfileViewModel`: when `refreshEngageUserData` returns `emailMarketingOptIn = false`,
      `engageUserData.emailMarketingOptIn` is `false`
- [ ] `AppProfileViewModel.updateContactOption(true)` calls `oloEngageManager.updateEngageUserData`
      with `email_marketing_opt_in = true` — NOT `userRepository.updateUserContactOptions`
- [ ] `AppProfileViewModel.updateContactOption(false)` calls `oloEngageManager.updateEngageUserData`
      with `email_marketing_opt_in = false`

## Designs / References

- Olo Engage getuser endpoint: `GET https://api.example.com/engage/getuser`
- Olo Engage updateuser endpoint: `POST https://api.example.com/engage/updateuser`
- Authoritative read field: `data.user.email_marketing_opt_in` (Boolean)
- Update request field: `fields.email_marketing_opt_in` (Boolean)
- Mapped in `OloEngageResponse.kt`: `GetUserEngageResponse → UserData → User.emailMarketingOptIn`

## Notes

The existing `GetUserEngageResponse.data.user.emailMarketingOptIn` field is already
mapped in `OloEngageResponse.kt` — no new network/response code needed for the read path.

For the update path, `OloEngageRequestBody.Fields` currently has no `email_marketing_opt_in`
field. This needs to be added so `updateUserEngageInfo` can carry the opt-in preference.

Key files:
- `app/.../views/profile/settings/AppSettingsFragment.kt` — reads `contactOptions.optin` today
- `app/.../views/profile/user/AppProfileViewModel.kt` — `loadContactOptions()`, `updateContactOption()`
- `app/.../managers/OloEngageManager.kt` — `refreshEngageUserData()`, `updateEngageUserData()`
- `app/.../managers/OloEngageManager.EngageUserData` (currently only has birthday + zipcode)
- `sdkNomNomOloExt/.../network/requests/OloEngageRequestBody.kt` — `Fields` needs new field
- `sdkNomNomOloExt/.../network/responses/OloEngageResponse.kt` — `emailMarketingOptIn` already exists
