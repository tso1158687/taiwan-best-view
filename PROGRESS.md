# Project Progress

Updated: 2026-06-17

## Current State

The project is published as a public GitHub repository:

- Repository: https://github.com/tso1158687/taiwan-best-view
- Default branch: `main`
- Latest recorded commit: `c80e86d Add case record import UI`
- Local branch status at the time of this note: `main...origin/main`

`test-files/`, `cases/`, `node_modules/`, and `.DS_Store` are intentionally ignored and should not be committed because they may contain real evidence photos, generated case data, dependencies, or local machine files.

## What Is Implemented

- Local static Web UI for creating and editing traffic-violation case drafts.
- Taipei and New Taipei jurisdiction selection for illegal-parking MVP cases.
- Attachment validation for official-site-compatible formats.
- iPhone HEIC/HEIF detection and macOS QuickLook conversion to PNG.
- Sidecar metadata preservation from the original HEIC files.
- EXIF-based occurred-at candidate extraction.
- GPS-based location candidate extraction.
- macOS CoreLocation reverse-geocoding attempt for GPS candidates.
- Apple Vision OCR for plate candidates and location text clues.
- Field suggestions for plate, district, road, and address note.
- Submission packet generation for Taipei and New Taipei.
- Guarded automation plans that stop before CAPTCHA, Email verification, declarations, and final submit.
- Official selector manifests for Taipei and New Taipei.
- Read-only live official-site preflight scripts.
- Local Playwright fixture fill verification without contacting official websites.
- Local case record creation, update, and case-history summary.
- Browser UI import for `case-record.json` and `case-history.json`.
- Public handoff documentation in `README.md` and detailed audit notes in `SELF_AUDIT.md`.

## Latest Verified Evidence

The latest full local verification recorded in `SELF_AUDIT.md` used:

- `npm run check`
- `npm run verify:ui`
- `npm run verify:test-files`

Latest end-to-end verifier output used case workspace:

- `cases/case-20260616T163821`

Important observed results from the real `test-files/` HEIC photos:

- Occurred-at candidate: `2026-06-12T15:32:11+08:00`
- GPS candidate: `25.022475, 121.426317`
- Reverse geocode status: `unavailable`, so the workflow kept coordinate/map candidates for manual review.
- Missing GPS attachment: `IMG_2630.HEIC`
- Plate candidates: `3999YG`, `3999-B`
- Location text candidates: `傳品牛排`
- Taipei local fixture fill: `ok`, 15 fields filled, 2 attachments uploaded, no final submit.
- New Taipei local fixture fill: `ok`, 19 fields filled, 2 attachments uploaded, no final submit.
- UI fixture verification: `ok`

## Known Limits

- Final official submission is intentionally manual.
- CAPTCHA, Email verification, personal-data declarations, and final submit are not bypassed or automated.
- Reporter identity/profile fields are not invented by the tool and must be provided by the user.
- GPS and reverse geocoding are only review candidates. They do not prove the road, direction, or exact legal location.
- CoreLocation reverse geocoding can time out or return unavailable.
- The converted PNG preserves original metadata in draft sidecar data, but full EXIF embedding into the submission image still needs a future `exiftool` integration if that becomes necessary.
- Taipei's official SPA can time out in headless Playwright during live preflight, so live official checks are diagnostic only.
- Browser UI case history is loaded by importing generated JSON; the static page does not scan the local `cases/` directory directly.

## Suggested Next Steps

1. Add a reporter-profile workflow that keeps personal data local and never commits it.
2. Add optional `exiftool` support to copy original EXIF into generated submission images.
3. Improve location review with a manual map confirmation UI.
4. Improve OCR confidence scoring and plate normalization.
5. Re-run read-only official preflights before any real assisted submission because official sites can change selectors.
6. For a real case, fill missing case fields and reporter profile, then run guarded dry-run/prototype commands before manually completing official verification and final submit.

## Resume Checklist

Before continuing development:

```sh
git status --short --branch --ignored
npm run check
npm run verify:ui
```

For full HEIC workflow verification on macOS with local test photos:

```sh
npm run verify:test-files
```
