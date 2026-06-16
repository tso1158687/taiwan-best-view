# Self Audit

Audit date: 2026-06-17

## Test Inputs

- `test-files/IMG_2630.HEIC`
- `test-files/IMG_2631.HEIC`

Both files are HEIC images from iPhone 16 Pro.

## Verified Workflow

Command:

```sh
npm run create:case -- test-files --jurisdiction taipei
```

Observed output:

- Created case workspace: `cases/case-20260616T024545`
- Copied original HEIC files to `originals/`
- Converted submission files to `converted/IMG_2630.png` and `converted/IMG_2631.png`
- Wrote `draft.json`
- Wrote `processing-report.json`
- Derived occurred-at candidate: `2026-06-12T15:32:11+08:00`
- Generated one GPS-based location candidate from `IMG_2631.HEIC`
- Attempted macOS CoreLocation reverse geocoding for the GPS candidate
- Listed `IMG_2630.HEIC` as missing GPS
- Extracted OCR text candidates with Apple Vision
- Extracted plate candidates including `3999YG` / `3999-B`
- Extracted location text candidates including `傳品牛排`
- Generated field suggestions for plate and address note
- Generated a Taipei submission packet with official URL, form mapping, attachments, missing fields, and required human stop points
- Generated a Taipei dry-run automation plan that refuses to proceed when required case or reporter fields are missing
- Generated a Taipei prototype run preflight that refuses to open the official site while required data is missing
- Generated a New Taipei submission packet and dry-run automation plan from the same HEIC test inputs
- Generated official selector reports for Taipei and New Taipei from public official-site HTML / JavaScript evidence
- Generated local case records that preserve submission status, automation status, attachment summaries, and manually filled official-case fields
- Verified local case-record update and case-summary logic for post-submission official case numbers
- Added `README.md` with installation, verification, safety boundaries, and common workflow commands for public handoff

Metadata evidence:

- `sips -s format jpeg` produced metadata-only or black JPG output for these HEIC files, so it is not acceptable as the primary submission renderer
- QuickLook produced visible PNG submission files with dimensions `1536 x 2048`
- Original HEIC metadata is preserved in draft sidecar data
- `IMG_2630.HEIC` does not contain GPS in sidecar metadata
- `IMG_2631.HEIC` contains GPS in sidecar metadata: `25.022475, 121.426317`
- CoreLocation reverse geocoding was attempted for `25.022475, 121.426317` and returned `unavailable` / `timeout` in the latest verification run, so the workflow correctly retained coordinate/map candidates instead of inventing an address
- Verification source: QuickLook image rendering plus local JPEG EXIF sidecar parser, without `exiftool`

## MVP Plan Status

### Phase 1: Case Draft Builder

Status: partially verified

Evidence:

- Static Web UI exists: `index.html`, `styles.css`, `app.js`
- Required fields exist for jurisdiction, violation type, plate, occurred time, district, road, address note, fact, description, attachments, and status
- JSON preview and JSON download exist
- JSON import exists
- HEIC/HEIF upload is detected and shown as requiring conversion to an official-site-compatible format

Remaining:

- Browser-native file import cannot be fully automated in the current browser test tool because file input setting is not exposed
- User-facing case list/history is not implemented

### Phase 1.5: Attachment Preprocessing and HEIC Conversion

Status: partially verified

Evidence:

- `scripts/create-case.mjs` creates case workspaces
- `scripts/convert-heic.mjs` converts HEIC/HEIF to PNG using macOS QuickLook
- Real HEIC files from `test-files/` converted successfully
- Converted PNG files are visible rendered images with readable pixel dimensions
- Sidecar metadata records captured time and GPS status from the original HEIC metadata probe
- Draft attachments record original and submission file names, paths, conversion status, EXIF status, GPS status, and verification source

Remaining:

- Full EXIF embedding into the submission image is still better with `exiftool`
- Current local parser preserves metadata in draft sidecar data, but does not embed missing metadata into the PNG

### Phase 2: Photo Parsing

Status: started

Evidence:

- Captured-at candidates are read from converted metadata and written to `draft.json`
- The earliest captured-at candidate is used as `occurredAt`
- Apple Vision OCR reads converted PNG files
- OCR plate candidates and location text candidates are written to `photoAnalysis`
- Plate and address note field suggestions are written to `fieldSuggestions`

Remaining:

- GPS extraction is not complete
- OCR output still requires manual confirmation and better confidence scoring
- Confidence scoring is not implemented

### Phase 3: Location Assistance

Status: started

Evidence:

- `scripts/lib/location-candidates.mjs` generates GPS-based candidates from sidecar metadata
- `scripts/lib/reverse-geocode.mjs` and `scripts/reverse-geocode.swift` attempt CoreLocation reverse geocoding for GPS candidates
- `draft.json` records `locationAssistance`
- `processing-report.json` records the generated GPS candidate and missing-GPS attachments
- Latest verification confirmed `reverseGeocodeStatus: "unavailable"` and kept `GPS 候選 25.022475, 121.426317` as a review-only suggestion
- Frontend has a `地點候選` panel for imported drafts
- Frontend has a `照片線索` panel and `欄位建議` panel for imported drafts

Remaining:

- Reverse geocoding can still be unavailable or timeout depending on Apple service/network state
- Road/intersection candidates still require a reliable map/geocoder result or manual input
- Confirmed frequent locations
- Manual map/location candidate UI

### Phase 4: Taipei Semi-Automated Form Filling

Status: started

Evidence:

- `scripts/prepare-submission.mjs` generates `submission-packet.json` from a case draft
- The Taipei packet points to `https://prsweb.tcpd.gov.tw/`
- The packet maps case date/time, plate parts, district, road, address note, fact, description, and attachments into a stable structure for automation
- The packet explicitly stops before Email verification, personal-data statements, truthfulness statement, and final submit
- The packet reports missing reporter profile fields instead of inventing personal data
- `scripts/taipei-dry-run.mjs` writes `taipei-automation-plan.json` without opening or submitting to the official site
- `scripts/taipei-prototype.mjs` writes `taipei-prototype-run.json` and refuses to contact the official site unless required data is complete and `--allow-network` is explicitly provided
- `scripts/lib/official-selector-manifests.mjs` records Taipei route, API, field, attachment, and human-stop selectors from the official Vue bundle observed on 2026-06-16
- `scripts/inspect-official-selectors.mjs taipei` validates 17 Taipei field locators and 3 human stop boundaries
- `scripts/live-official-preflight.mjs taipei --allow-network` performs a read-only official-site preflight that does not fill data, upload files, click verification controls, or submit forms
- `scripts/run-fixture-fill.mjs` uses Playwright Chromium against a local official-like fixture to verify browser filling without contacting the official site
- The dry-run plan is `blocked_by_missing_data` for the current test case because plate, district, road, and reporter fields are still missing
- The dry-run plan marks Email verification, declarations, and final submit as human-required stop points
- Verification confirmed `taipeiPrototypeStatus: "blocked_by_missing_data"`, `taipeiSelectorFieldCount: 17`, no external side effects, and no final submit path
- Verification confirmed `taipeiFixtureFillStatus: "ok"`, `taipeiFixtureFilledFields: 15`, `taipeiFixtureUploadedAttachments: 2`, and no triggered human stop or final submit
- Live official preflight wrote `cases/taipei-live-preflight.json` with `status: "needs_official_recheck"` because the Taipei SPA timed out in headless Playwright before visible reporter fields became available
- Latest written Taipei evidence: `cases/case-20260616T031513/taipei-fixture-fill-report.json`, `taipei-automation-plan.json`, and `case-record.json`

Remaining:

- Live Taipei run still needs user-confirmed complete case data and reporter profile before it can safely open the official site
- Email verification, pre-submit summary, declarations, and final submit remain human-gated

### Phase 5: New Taipei Semi-Automated Form Filling

Status: started

Evidence:

- `scripts/lib/new-taipei-automation-plan.mjs` creates a guarded New Taipei automation plan from `submission-packet.json`
- `scripts/new-taipei-dry-run.mjs` writes `new-taipei-automation-plan.json` without opening or submitting to the official site
- `scripts/new-taipei-prototype.mjs` writes `new-taipei-prototype-run.json` and refuses to contact the official site unless required data is complete and `--allow-network` is explicitly provided
- `scripts/lib/official-selector-manifests.mjs` records New Taipei route, form field, attachment, CAPTCHA, Email, and final-submit selectors from official HTML observed on 2026-06-16
- `scripts/inspect-official-selectors.mjs new_taipei` validates 20 New Taipei field locators and 4 human stop boundaries
- `scripts/live-official-preflight.mjs new_taipei --allow-network` performs a read-only official-site preflight that does not fill data, upload files, click verification controls, or submit forms
- `scripts/run-fixture-fill.mjs` handles New Taipei's separate `upfile` attachment inputs and verifies browser filling without contacting the official site
- The New Taipei packet points to `https://tvrs.ntpd.gov.tw/`
- The plan stops for disclaimer confirmation, CAPTCHA, Email verification, and final submit
- Verification confirmed `newTaipeiDryRunStatus: "blocked_by_missing_data"`, `newTaipeiPrototypeStatus: "blocked_by_missing_data"`, `newTaipeiDryRunManualStops: 4`, and `newTaipeiSelectorFieldCount: 20`
- Verification confirmed `newTaipeiFixtureFillStatus: "ok"`, `newTaipeiFixtureFilledFields: 19`, `newTaipeiFixtureUploadedAttachments: 2`, and no triggered human stop or final submit
- Live official preflight wrote `cases/new-taipei-live-preflight.json` with `status: "ok"`, 20 present selectors, and no missing selectors
- Latest written New Taipei evidence: `cases/case-20260616T031513/new-taipei-fixture-fill-report.json`

Remaining:

- Live New Taipei run still needs user-confirmed complete case data and reporter profile before it can safely open the official site
- CAPTCHA, Email verification, pre-submit summary, and final submit remain human-gated

### Phase 6: Case Records

Status: CLI workflow verified

Evidence:

- Local case workspace structure exists under `cases/<case-id>/`
- `draft.json` and `processing-report.json` are generated
- `scripts/lib/case-records.mjs` creates a local record with workflow status, official URL, attachment summary, manual stop IDs, and blank fields for official case number / lookup password / submitted time
- `scripts/write-case-record.mjs` writes `case-record.json` next to the draft
- `scripts/update-case-record.mjs` updates official case number, lookup password, submitted time, correction status, and local/submission statuses after manual official submission
- `scripts/list-cases.mjs` reads local `case-record.json` files and outputs a case history summary
- Verification confirmed `caseRecordStatus: "needs_missing_data"`, `updatedCaseRecordStatus: "submitted_by_user"`, `caseSummaryOfficialCaseNumber: "TP-FIXTURE-0001"`, and preserved final-submit as a human stop
- File-level check wrote `cases/case-20260616T160849/case-record.json` with `TP-FIXTURE-0001` and generated `cases/case-history.json` containing 6 local case summaries

Remaining:

- Official case number, lookup password, submission time, and correction status still require manual entry after official submission
- Case history is available through CLI JSON, not a browser UI

### Public Handoff

Status: ready for repository publication after final commit

Evidence:

- `README.md` documents installation, common commands, safety boundaries, test-files verification, and current limits
- `.gitignore` excludes `test-files/`, `cases/`, `node_modules/`, and `.DS_Store`
- No real test photos or generated case folders are staged for version control

## Verification Commands

```sh
npm run check
npm run verify:test-files
npm run inspect:selectors -- taipei
npm run inspect:selectors -- new_taipei
npm run official:preflight -- taipei --allow-network --json cases/taipei-live-preflight.json
npm run official:preflight -- new_taipei --allow-network --json cases/new-taipei-live-preflight.json
npm run create:case -- test-files --jurisdiction taipei
npm run prepare:submission -- cases/case-20260616T031513/draft.json
npm run taipei:dry-run -- cases/case-20260616T031513/submission-packet.json
npm run fixture:fill -- cases/case-20260616T031513/submission-packet.json --jurisdiction taipei
npm run fixture:fill -- cases/case-20260616T031513/submission-packet.json --jurisdiction new_taipei
npm run update:case-record -- cases/case-20260616T160849/case-record.json --case-number TP-FIXTURE-0001 --lookup-password fixture-only --submitted-at 2026-06-16T12:00:00+08:00 --submission-status submitted_by_user --local-status submitted --correction-status none
npm run list:cases -- cases --json cases/case-history.json
npm run create:case -- test-files --jurisdiction new_taipei
npm run prepare:submission -- cases/case-20260616T030331/draft.json
npm run new-taipei:dry-run -- cases/case-20260616T030331/submission-packet.json
npm run new-taipei:prototype -- cases/case-20260616T030331/new-taipei-automation-plan.json
npm run write:case-record -- cases/case-20260616T031513/draft.json cases/case-20260616T031513/submission-packet.json cases/case-20260616T031513/taipei-automation-plan.json
npm run write:case-record -- cases/case-20260616T030331/draft.json cases/case-20260616T030331/submission-packet.json cases/case-20260616T030331/new-taipei-automation-plan.json
node scripts/convert-heic.mjs test-files /tmp/taiwan-best-view-converted-2
find cases/case-20260616T024545/converted -maxdepth 1 -type f -exec file {} \;
```

All listed commands completed successfully by the 2026-06-17 audit, except where older case IDs are retained as prior evidence. The latest end-to-end verifier used `cases/case-20260616T163004`; the latest case-record file checks used `cases/case-20260616T160849`; the latest live official preflight reports were written to `cases/taipei-live-preflight.json` and `cases/new-taipei-live-preflight.json`.
