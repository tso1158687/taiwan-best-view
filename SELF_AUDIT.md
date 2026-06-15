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

- Created case workspace: `cases/case-20260615T052016`
- Copied original HEIC files to `originals/`
- Converted submission files to `converted/IMG_2630.png` and `converted/IMG_2631.png`
- Wrote `draft.json`
- Wrote `processing-report.json`
- Derived occurred-at candidate: `2026-06-12T15:32:11+08:00`
- Generated one GPS-based location candidate from `IMG_2631.HEIC`
- Listed `IMG_2630.HEIC` as missing GPS
- Extracted OCR text candidates with Apple Vision
- Extracted plate candidates including `3999YG` / `3999-B`
- Extracted location text candidates including `傳品牛排`
- Generated field suggestions for plate and address note

Metadata evidence:

- `sips -s format jpeg` produced metadata-only or black JPG output for these HEIC files, so it is not acceptable as the primary submission renderer
- QuickLook produced visible PNG submission files with dimensions `1536 x 2048`
- Original HEIC metadata is preserved in draft sidecar data
- `IMG_2630.HEIC` does not contain GPS in sidecar metadata
- `IMG_2631.HEIC` contains GPS in sidecar metadata: `25.022475, 121.426317`
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
- `draft.json` records `locationAssistance`
- `processing-report.json` records the generated GPS candidate and missing-GPS attachments
- Frontend has a `地點候選` panel for imported drafts
- Frontend has a `照片線索` panel and `欄位建議` panel for imported drafts

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
find cases/case-20260615T052016/converted -maxdepth 1 -type f -exec file {} \;
```

All listed commands completed successfully on 2026-06-15.
