# Project Progress

Updated: 2026-07-09

## Current State

The project is published as a public GitHub repository:

- Repository: https://github.com/tso1158687/taiwan-best-view
- Default branch: `main`
- Progress baseline before reporter-profile and metadata-tooling work: `cb63e72 Record current project progress`
- Local branch status at the time of this update: `main...origin/main` before the current work is committed

`test-files/`, `cases/`, `node_modules/`, reporter-profile local files, and `.DS_Store` are intentionally ignored and should not be committed because they may contain real evidence photos, generated case data, personal data, dependencies, or local machine files.

## What Is Implemented

- Local static Web UI for creating and editing traffic-violation case drafts.
- Draft validation for core fields, attachment metadata, and saved human-review state.
- Taipei and New Taipei jurisdiction selection for illegal-parking MVP cases.
- Attachment validation for official-site-compatible formats.
- iPhone HEIC/HEIF detection and macOS QuickLook conversion to PNG.
- Sidecar metadata preservation from the original HEIC files.
- EXIF-based occurred-at candidate extraction.
- GPS-based location candidate extraction.
- macOS CoreLocation reverse-geocoding attempt for GPS candidates.
- Manual location candidate adoption in the browser UI, recorded as `locationReview`.
- Local confirmed frequent-location recording and reuse as review-only candidates.
- Apple Vision OCR for plate candidates and location text clues.
- OCR plate normalization, confidence scoring, confidence reasons, and official form splitting.
- Field suggestions for plate, district, road, and address note.
- Browser UI field suggestion adoption recorded as `fieldReview` for later readiness review.
- Submission packet generation for Taipei and New Taipei.
- Real-case readiness reports that gate official-site opening on complete local case and reporter data.
- Readiness reports flag missing, future, or locally stale violation times for manual timeliness review.
- Official preflight freshness gate in readiness reports and checklists.
- Human-readable readiness Markdown checklists that omit reporter-profile values.
- Local reporter profile validation, optional encrypted-at-rest storage, and submission-packet integration.
- Guarded automation plans that stop before CAPTCHA, Email verification, declarations, and final submit.
- Official selector manifests for Taipei and New Taipei.
- Read-only live official-site preflight scripts.
- Local Playwright fixture fill verification without contacting official websites.
- Local case record creation, update, and case-history summary.
- Browser UI import for `case-readiness-report.json`, `case-workflow-checklist.json`, `case-record.json`, and `case-history.json`.
- Metadata tooling diagnostics for QuickLook and optional exiftool embedding.
- Public handoff documentation in `README.md` and detailed audit notes in `SELF_AUDIT.md`.

## Latest Verified Evidence

The latest full local verification recorded in `SELF_AUDIT.md` used:

- `npm run check`
- `npm run verify:ui`
- `npm run verify:test-files`
- `npm run inspect:metadata`
- `npm run verify:plate`
- `npm run verify:readiness`
- `npm run verify:locations`
- `npm run official:preflight -- taipei --allow-network --json cases/taipei-live-preflight.json`
- `npm run official:preflight -- new_taipei --allow-network --json cases/new-taipei-live-preflight.json`

Latest end-to-end verifier output used case workspace:

- `cases/case-20260708T172343`

Important observed results from the real `test-files/` HEIC photos:

- Occurred-at candidate: `2026-06-12T15:32:11+08:00`
- GPS candidate: `25.022475, 121.426317`
- Reverse geocode status: `unavailable`, so the workflow kept coordinate/map candidates for manual review.
- Missing GPS attachment: `IMG_2630.HEIC`
- Plate candidates: `3999-YG`, `3999-B`
- Plate candidate patterns: `four_digits_two_letters`, `four_digits_one_letter_incomplete`
- Location text candidates: `傳品牛排`
- Taipei local fixture fill: `ok`, 15 fields filled, 2 attachments uploaded, no final submit.
- New Taipei local fixture fill: `ok`, 19 fields filled, 2 attachments uploaded, no final submit.
- UI fixture verification: `ok`
- Case draft validation verification: `ok`, generated drafts pass and invalid fixture drafts fail with specific issues.
- Review-state validation verification: `ok`, invalid `locationReview` and `fieldReview` fixtures fail with specific issues.
- Case workflow checklist verification: `ok`, artifact status, recommended next action, and next-command hints generated from local case folders.
- Case workflow recommended next action verification: `workflow_complete` after packet, readiness, automation plan, case record, and summary exist.
- Case workflow checklist UI import verification: `ok`
- Case readiness report UI import verification: `ok`
- Location candidate confirmation UI verification: `ok`
- Field suggestion confirmation UI verification: `ok`, adopted plate suggestion recorded in `fieldReview`.
- Confirmed frequent-location candidate verification: `ok`
- Reporter-profile fixture status: `ready`
- Encrypted reporter-profile fixture verification: `ok`, encrypted envelope does not contain fixture identity number or email plaintext.
- Reviewed packet status with complete fixture-only case and reporter fields: `ready_for_human_review`
- Case readiness gate with incomplete real-case fields: `needs_missing_data`, official-site opening blocked.
- Case readiness gate with complete fixture-only case, reporter fields, and fresh official preflight: `ready_for_human_review`, official-site opening allowed for human review only.
- Occurred-at freshness verification: `older_than_review_window`, timestamp risk is shown as a review warning.
- Field review readiness verification: `candidate_confirmed_by_user`, adopted OCR/field suggestions are recorded for review.
- Case readiness gate with complete local data but missing/stale official preflight: `needs_official_preflight`.
- Guarded prototype gate with complete local data but missing readiness report: `blocked_by_readiness_report`.
- Guarded prototype gate with complete local data and ready readiness report: `ready_for_guarded_browser`.
- Guarded New Taipei prototype rejects a Taipei readiness report with jurisdiction and official URL mismatch issues.
- Case readiness Markdown checklist verification: `ok`, reporter-profile values omitted.
- Case record Markdown summary verification: `ok`, official case number included and lookup password value omitted.
- Case correction tracking verification: `ok`, correction status, due time, and item count recorded in summaries and UI.
- Metadata embedding statuses on this machine: `sidecar_only`, `sidecar_only`
- Latest Taipei official preflight: `ok`, 6 present selectors, 3 deferred selectors, 0 missing selectors.
- Latest New Taipei official preflight: `ok`, 20 present selectors, 0 missing selectors.

## Known Limits

- Final official submission is intentionally manual.
- CAPTCHA, Email verification, personal-data declarations, and final submit are not bypassed or automated.
- Reporter identity/profile fields are not invented by the tool and must be provided by the user.
- Encrypted reporter profiles require the user's local `REPORTER_PROFILE_PASSPHRASE`; losing the passphrase means the project cannot decrypt the profile.
- GPS and reverse geocoding are only review candidates. Even after the user adopts a candidate, they do not prove the road, direction, or exact legal location.
- Confirmed frequent locations are local hints only and must be re-checked against the current photo evidence.
- CoreLocation reverse geocoding can time out or return unavailable.
- The converted PNG preserves original metadata in draft sidecar data. If `exiftool` is installed, conversion attempts metadata embedding and falls back to sidecar metadata if embedding fails.
- Taipei's official SPA can time out in headless Playwright during live preflight, so live official checks are diagnostic only.
- Browser UI case history is loaded by importing generated JSON; the static page does not scan the local `cases/` directory directly.

## Suggested Next Steps

1. For a real case, fill missing case fields and reporter profile, then run guarded dry-run/readiness/prototype commands before manually completing official verification and final submit.
2. Keep re-running read-only official preflights before real assisted submission because official sites can change selectors.
3. Run `npm run review:case -- cases/<case-id>/draft.json reporter-profile.local.json --official-preflight cases/<jurisdiction>-live-preflight.json` before any live official-site run.
4. Pass the resulting same-jurisdiction `case-readiness-report.json` to `taipei:prototype` or `new-taipei:prototype` with `--readiness-report` before using `--allow-network`.
5. After manually confirming a location, run `npm run record:location -- cases/<case-id>/draft.json` so later cases can reuse it as a review-only candidate.

## Resume Checklist

Before continuing development:

```sh
git status --short --branch --ignored
npm run check
npm run inspect:metadata
npm run verify:plate
npm run verify:readiness
npm run verify:locations
npm run verify:ui
```

For full HEIC workflow verification on macOS with local test photos:

```sh
npm run verify:test-files
```
