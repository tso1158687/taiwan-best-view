# Self Audit

Audit date: 2026-06-15

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

- Created case workspace: `cases/case-20260615T045149`
- Copied original HEIC files to `originals/`
- Converted submission files to `converted/IMG_2630.jpg` and `converted/IMG_2631.jpg`
- Wrote `draft.json`
- Wrote `processing-report.json`
- Derived occurred-at candidate: `2026-06-12T15:32:11+08:00`
- Generated one GPS-based location candidate from `IMG_2631.HEIC`
- Listed `IMG_2630.HEIC` as missing GPS

Metadata evidence:

- `IMG_2630.jpg` contains JPEG EXIF date `2026:06:12 15:32:11`
- `IMG_2631.jpg` contains JPEG EXIF date `2026:06:12 15:36:49`
- `IMG_2630.jpg` does not contain GPS in the converted JPG
- `IMG_2631.jpg` contains GPS in the converted JPG: `25.022475, 121.426317`
- Verification source: local JPEG EXIF parser, without `exiftool`

## MVP Plan Status

### Phase 1: Case Draft Builder

Status: partially verified

Evidence:

- Static Web UI exists: `index.html`, `styles.css`, `app.js`
- Required fields exist for jurisdiction, violation type, plate, occurred time, district, road, address note, fact, description, attachments, and status
- JSON preview and JSON download exist
- JSON import exists
- HEIC/HEIF upload is detected and shown as requiring JPG conversion

Remaining:

- Browser-native file import cannot be fully automated in the current browser test tool because file input setting is not exposed
- User-facing case list/history is not implemented

### Phase 1.5: Attachment Preprocessing and HEIC Conversion

Status: partially verified

Evidence:

- `scripts/create-case.mjs` creates case workspaces
- `scripts/convert-heic.mjs` converts HEIC/HEIF to JPG using macOS `sips`
- Real HEIC files from `test-files/` converted successfully
- Converted JPG files contain EXIF date metadata
- Local JPEG EXIF parser can detect whether GPS is present in the converted JPG
- Draft attachments record original and submission file names, paths, conversion status, EXIF status, GPS status, and verification source

Remaining:

- Full EXIF copying is still better with `exiftool`
- Current local parser can verify date and GPS presence after conversion, but does not yet copy missing metadata from the original HEIC into the JPG

### Phase 2: Photo Parsing

Status: started

Evidence:

- Captured-at candidates are read from converted metadata and written to `draft.json`
- The earliest captured-at candidate is used as `occurredAt`

Remaining:

- GPS extraction is not complete
- OCR for plate and location clues is not implemented
- Confidence scoring is not implemented

### Phase 3: Location Assistance

Status: started

Evidence:

- `scripts/lib/location-candidates.mjs` generates GPS-based candidates from converted JPG EXIF
- `draft.json` records `locationAssistance`
- `processing-report.json` records the generated GPS candidate and missing-GPS attachments
- Frontend has a `地點候選` panel for imported drafts

Remaining:

- Reverse geocoding
- Road/intersection candidates
- OCR-based location clues
- Confirmed frequent locations
- Manual map/location candidate UI

### Phase 4: Taipei Semi-Automated Form Filling

Status: not implemented

Remaining:

- Playwright prototype for Taipei official site
- Email verification pause
- Attachment upload
- Pre-submit summary and human confirmation

### Phase 5: New Taipei Semi-Automated Form Filling

Status: not implemented

Remaining:

- Playwright prototype for New Taipei official site
- Disclaimer step handling
- CAPTCHA and Email verification pause
- Attachment upload
- Pre-submit summary and human confirmation

### Phase 6: Case Records

Status: started

Evidence:

- Local case workspace structure exists under `cases/<case-id>/`
- `draft.json` and `processing-report.json` are generated

Remaining:

- Official case number, lookup password, submission time, correction status, and case history UI are not implemented

## Verification Commands

```sh
npm run check
npm run verify:test-files
npm run create:case -- test-files --jurisdiction taipei
node scripts/convert-heic.mjs test-files /tmp/taiwan-best-view-converted-2
find cases/case-20260615T045149/converted -maxdepth 1 -type f -exec file {} \;
```

All listed commands completed successfully on 2026-06-15.
