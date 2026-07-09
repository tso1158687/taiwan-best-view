# MVP Completion Audit

Updated: 2026-07-09

This audit maps `MVP_PLAN.md` to the current implementation and verification evidence. The MVP is considered complete for the local-first, semi-automated workflow: the project can prepare, review, locally verify, and safely hand off Taipei or New Taipei traffic-violation reports for human-controlled official submission.

This does not mean an official report has been submitted. Real reporter identity data, CAPTCHA, Email verification, official declarations, and final submission remain manual by design.

## Verification Baseline

Latest verified commands:

- `npm run check`
- `npm run verify:ui`
- `npm run verify:test-files`
- `npm run inspect:metadata`
- `npm run verify:plate`
- `npm run verify:readiness`
- `npm run verify:locations`

Latest end-to-end fixture case:

- `cases/case-20260708T181739`

Latest pushed implementation baseline before this audit:

- `8aecf19 Require official receipt details`

## Requirement Traceability

| MVP area | Plan requirement | Current evidence | Status |
| --- | --- | --- | --- |
| Phase 1: case draft builder | Create local drafts, choose Taipei/New Taipei, illegal-parking case type, 1 to 5 attachments, editable case fields, save JSON, detect HEIC/HEIF | `index.html`, `app.js`, `case-schema.json`, `scripts/create-case.mjs`, `scripts/validate-case-draft.mjs`; verified by `npm run verify:test-files` and `npm run verify:ui` | Complete |
| Phase 1.5: HEIC preprocessing | Detect HEIC/HEIF, convert to official-compatible PNG/JPG, preserve metadata, verify DateTime/GPS candidates, record original and submission files, show conversion state in UI | `scripts/lib/heic-conversion.mjs`, `scripts/lib/metadata.mjs`, `scripts/convert-heic.mjs`, `scripts/create-case.mjs`, UI attachment badges; verified by `npm run inspect:metadata`, `npm run verify:test-files`, and `npm run verify:ui` | Complete with sidecar fallback |
| Phase 2: photo parsing | Read metadata, extract EXIF time/GPS, OCR plate and location text, check size/format, show confidence or manual-review state | `scripts/lib/photo-analysis.mjs`, `scripts/lib/plate-normalization.mjs`, `scripts/lib/field-suggestions.mjs`, `scripts/lib/submission-packet.mjs`; verified by `npm run verify:test-files`, `npm run verify:plate`, and UI fixture checks | Complete |
| Phase 3: location assistance | Combine EXIF GPS, reverse geocode, OCR text, confirmed frequent locations, and manual input without blindly trusting GPS | `scripts/lib/location-candidates.mjs`, `scripts/lib/reverse-geocode.mjs`, `scripts/lib/confirmed-locations.mjs`, `scripts/record-confirmed-location.mjs`; verified by `npm run verify:test-files`, `npm run verify:locations`, and UI confirmation checks | Complete |
| Phase 4: Taipei semi-automated form filling | Build guarded Taipei automation with Email verification and final submit left to the user | `scripts/lib/taipei-automation-plan.mjs`, `scripts/taipei-dry-run.mjs`, `scripts/taipei-prototype.mjs`, `scripts/run-fixture-fill.mjs`, `scripts/run-plan-fixture.mjs`; verified by `npm run verify:test-files` | Complete within safety boundary |
| Phase 5: New Taipei semi-automated form filling | Build guarded New Taipei automation with CAPTCHA, Email verification, declarations, and final submit left to the user | `scripts/lib/new-taipei-automation-plan.mjs`, `scripts/new-taipei-dry-run.mjs`, `scripts/new-taipei-prototype.mjs`, `scripts/run-fixture-fill.mjs`, `scripts/run-plan-fixture.mjs`; verified by `npm run verify:test-files` | Complete within safety boundary |
| Phase 6: case records | Record draft time, submission status, official case number, lookup password, submitted time, attachment summary, and correction state | `scripts/lib/case-records.mjs`, `scripts/write-case-record.mjs`, `scripts/update-case-record.mjs`, `scripts/export-case-record-summary.mjs`, `scripts/list-cases.mjs`; verified by `npm run verify:test-files` | Complete |
| Safety gates | Keep CAPTCHA, Email verification, declarations, and final submit manual | `scripts/lib/form-prototype.mjs`, readiness reports, plan fixture reports, pre-submit review, official receipt gate; verified by `npm run verify:readiness` and `npm run verify:test-files` | Complete |

## Completion Definition

The MVP is complete when all of these are true:

- A local user can create a case draft from iPhone photos or official-compatible videos.
- HEIC/HEIF photos are converted to an official-compatible submission format before form handoff.
- Original metadata is preserved in local sidecar data and, when available, embedded with `exiftool`.
- The tool provides review candidates for time, plate, and location, while requiring human confirmation.
- Taipei and New Taipei automation plans stop at human gates and never submit by default.
- Official-site handoff is blocked unless local data, reporter profile, readiness report, official preflight, and plan fixture evidence match.
- After manual official submission, the local record is not considered receipt-complete until official case number and submitted time are recorded.
- Local UI and CLI verification cover the above behavior without committing personal data or generated case folders.

All completion conditions are currently satisfied by the verification baseline above.

## Remaining Non-MVP Work

These are intentionally outside the current MVP:

- Submitting a real official report end to end.
- Automating CAPTCHA, Email verification, identity declarations, or final submit.
- Replacing JSON files with SQLite.
- Automatically scanning the local `cases/` directory from the static browser UI.
- Guaranteeing that GPS/OCR-derived locations are legally correct without human review.
