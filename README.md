# Taiwan Best View

Taiwan Best View is a local-first helper for preparing Taiwan traffic violation report drafts. It focuses on reducing repetitive form work while keeping identity verification, CAPTCHA, declarations, and final submission under the user's control.

## What It Does

- Creates local case drafts for Taipei and New Taipei traffic violation reports.
- Preserves draft `createdAt` separately from `updatedAt` for local case tracking.
- Converts iPhone HEIC/HEIF photos to official-site-compatible PNG files.
- Preserves original photo metadata in draft sidecar data for time and GPS review.
- Extracts EXIF time, GPS candidates, OCR plate candidates, and location text clues.
- Normalizes OCR plate candidates into official-form-friendly plate parts with confidence reasons.
- Attempts macOS CoreLocation reverse geocoding for GPS candidates when available.
- Lets the user manually adopt a GPS/map candidate into the draft as `locationReview`.
- Records manually adopted OCR/field suggestions in the draft as `fieldReview`.
- Records and reuses local confirmed frequent locations as review-only location candidates.
- Builds submission packets for Taipei and New Taipei.
- Reviews case readiness before opening official websites for human-reviewed submission.
- Flags missing, future, or locally stale violation times in readiness reports for manual timeliness review.
- Writes human-readable readiness checklists for official-site manual review.
- Validates official-site selector manifests and guarded automation stop points.
- Runs Playwright fixture fills locally without contacting official websites.
- Records local case status, official case number, lookup password, and correction status after manual submission.
- Imports case-readiness reports, workflow checklists, local case records, and case-history JSON into the browser UI for review, including whether a lookup password is stored without showing the value.
- Validates local reporter profiles without printing personal data values, with optional encrypted-at-rest storage.

## Safety Boundaries

This project does not bypass CAPTCHA, Email verification, identity declarations, or final submission. Official websites are not contacted by the default verification flow. Live official-site automation must only run after the user confirms the case facts and reporter profile.

Do not commit real evidence photos, generated case folders, reporter profiles, or personal data. The repository ignores `test-files/`, `cases/`, reporter-profile local files, and `node_modules/`.

## Requirements

- macOS for HEIC rendering through QuickLook and OCR through Apple Vision.
- Node.js 18 or newer.
- Playwright Chromium for local fixture browser verification.

Install dependencies:

```sh
npm install
npx playwright install chromium
```

## Common Commands

Syntax check:

```sh
npm run check
```

Create a local Taipei case from photos:

```sh
npm run create:case -- test-files --jurisdiction taipei
npm run create:case -- test-files --jurisdiction taipei --confirmed-locations confirmed-locations.local.json
npm run validate:case-draft -- cases/<case-id>/draft.json
npm run review:workflow -- cases/<case-id> --markdown cases/<case-id>/case-workflow-checklist.md
```

`validate:case-draft` checks the local draft structure, attachment metadata fields, and saved human-review state such as `locationReview` and `fieldReview`. It does not read attachment file contents or contact official websites.
`review:workflow` checks which local artifacts exist in a case folder, highlights one recommended next action, and lists the next safe commands. You can import `case-workflow-checklist.json` with the browser UI's `匯入 JSON` button.

Check local metadata tooling:

```sh
npm run inspect:metadata
```

If `exiftool` is installed, HEIC conversion attempts to embed/copy original metadata into generated PNG files. If it is not installed or embedding fails, the workflow keeps original metadata in draft sidecar data and marks the converted attachment accordingly.

Create and validate a private reporter profile:

```sh
npm run init:reporter-profile
npm run validate:reporter-profile -- reporter-profile.local.json
read -s REPORTER_PROFILE_PASSPHRASE
export REPORTER_PROFILE_PASSPHRASE
npm run encrypt:reporter-profile -- reporter-profile.local.json reporter-profile.local.encrypted.json
npm run validate:reporter-profile -- reporter-profile.local.encrypted.json
```

The validator reports missing/invalid field names only. It does not print identity numbers, names, phone numbers, addresses, or email values. Encrypted reporter profiles use local AES-256-GCM encryption and require `REPORTER_PROFILE_PASSPHRASE` when passed to `validate:reporter-profile`, `prepare:submission`, or `review:case`.

Prepare a submission packet:

```sh
npm run prepare:submission -- cases/<case-id>/draft.json
npm run prepare:submission -- cases/<case-id>/draft.json reporter-profile.local.json
npm run prepare:submission -- cases/<case-id>/draft.json reporter-profile.local.encrypted.json
```

Review whether a case is ready to open on the official website:

```sh
npm run review:case -- cases/<case-id>/draft.json
npm run review:case -- cases/<case-id>/draft.json reporter-profile.local.json
npm run review:case -- cases/<case-id>/draft.json reporter-profile.local.encrypted.json
npm run review:case -- cases/<case-id>/draft.json reporter-profile.local.json --official-preflight cases/taipei-live-preflight.json --markdown cases/<case-id>/case-readiness-checklist.md
```

This writes `case-readiness-report.json` and `case-readiness-checklist.md` next to the draft by default. They report missing case fields, reporter-profile readiness, attachment and metadata review notes, official human stop points, official-preflight freshness, and the next safe commands. They do not contact official websites. The checklist intentionally omits reporter-profile values; you can import the JSON report with the browser UI's `匯入 JSON` button.

Record a confirmed frequent location after you have reviewed a draft:

```sh
npm run record:location -- cases/<case-id>/draft.json
```

This writes `confirmed-locations.local.json`. The file is ignored by git because it can reveal places you often report. Pass it back into `create:case` with `--confirmed-locations` to add matching frequent locations as review-only candidates.

Generate guarded automation plans:

```sh
npm run taipei:dry-run -- cases/<case-id>/submission-packet.json
npm run new-taipei:dry-run -- cases/<case-id>/submission-packet.json
```

Run guarded official-site prototypes only after readiness review has passed:

```sh
npm run taipei:prototype -- cases/<case-id>/taipei-automation-plan.json --readiness-report cases/<case-id>/case-readiness-report.json --allow-network
npm run new-taipei:prototype -- cases/<case-id>/new-taipei-automation-plan.json --readiness-report cases/<case-id>/case-readiness-report.json --allow-network
```

The prototype commands refuse `--allow-network` runs unless the readiness report says the case can open the official site for human review. That requires complete local data, a fresh matching read-only official preflight, and a readiness report whose jurisdiction and official URL match the automation plan.

Run read-only live official-site preflights:

```sh
npm run official:preflight -- taipei --allow-network --json cases/taipei-live-preflight.json
npm run official:preflight -- new_taipei --allow-network --json cases/new-taipei-live-preflight.json
```

These preflights open official websites and check visible selectors. They do not fill data, upload files, click verification controls, or submit forms.

Run local browser fixture fills:

```sh
npm run fixture:fill -- cases/<case-id>/submission-packet.json --jurisdiction taipei
npm run fixture:fill -- cases/<case-id>/submission-packet.json --jurisdiction new_taipei
```

Write and update case records:

```sh
npm run write:case-record -- cases/<case-id>/draft.json cases/<case-id>/submission-packet.json cases/<case-id>/taipei-automation-plan.json
npm run update:case-record -- cases/<case-id>/case-record.json --case-number TP123456 --lookup-password "manual-password" --submitted-at 2026-06-16T12:00:00+08:00 --submission-status submitted_by_user
npm run update:case-record -- cases/<case-id>/case-record.json --correction-status needs_action --correction-due-at 2026-06-20T23:59:59+08:00 --correction-item "補上更清楚的車牌照片"
npm run export:case-record -- cases/<case-id>/case-record.json
npm run list:cases
```

`export:case-record` writes `case-record-summary.md` next to the JSON record. The summary is intended for human review and archive notes; it reports whether a lookup password is stored in the JSON, but does not print the password value.

To review case history in the browser UI, write a JSON summary and import it with the `匯入 JSON` button. The history summary reports whether a lookup password is stored, but does not include the password value:

```sh
npm run list:cases -- cases --json cases/case-history.json
```

End-to-end local verification with `test-files/`:

```sh
npm run verify:test-files
```

Browser UI fixture verification:

```sh
npm run verify:ui
```

Plate normalization verification:

```sh
npm run verify:plate
```

Real-case readiness gate verification:

```sh
npm run verify:readiness
```

Confirmed frequent-location verification:

```sh
npm run verify:locations
```

## Current Limits

- The generated PNG submission files are visually rendered and metadata is preserved in draft sidecar data.
- On machines with `exiftool`, conversion attempts metadata embedding and falls back to sidecar metadata if embedding fails. Run `npm run inspect:metadata` to confirm the local mode.
- GPS and reverse geocoding are only starting points. If Apple CoreLocation times out or returns no placemark, the tool keeps coordinate/map candidates and requires manual confirmation.
- Confirmed frequent locations are convenience hints only. The location review UI records which candidate the user adopted, but it still does not prove the legal road segment or driving direction.
- Live official-site automation is guarded and should not proceed until real case data and reporter profile fields are complete.
- Reporter profiles can be kept as ignored plaintext JSON for manual editing or converted into ignored encrypted JSON. Keep the passphrase outside the repository.
- `review:case` can report that local data plus a fresh read-only official preflight are ready to open the official site for human review, but CAPTCHA, Email verification, declarations, and final submit remain manual.
- `taipei:prototype` and `new-taipei:prototype` require a ready, matching-jurisdiction `case-readiness-report.json` before any `--allow-network` official-site run.
- Taipei's official SPA may time out in headless Playwright even when static resources are reachable; use `official:preflight` as a diagnostic rather than a submission path.
- Final submission remains manual.
