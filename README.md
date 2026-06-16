# Taiwan Best View

Taiwan Best View is a local-first helper for preparing Taiwan traffic violation report drafts. It focuses on reducing repetitive form work while keeping identity verification, CAPTCHA, declarations, and final submission under the user's control.

## What It Does

- Creates local case drafts for Taipei and New Taipei traffic violation reports.
- Converts iPhone HEIC/HEIF photos to official-site-compatible PNG files.
- Preserves original photo metadata in draft sidecar data for time and GPS review.
- Extracts EXIF time, GPS candidates, OCR plate candidates, and location text clues.
- Builds submission packets for Taipei and New Taipei.
- Validates official-site selector manifests and guarded automation stop points.
- Runs Playwright fixture fills locally without contacting official websites.
- Records local case status, official case number, lookup password, and correction status after manual submission.

## Safety Boundaries

This project does not bypass CAPTCHA, Email verification, identity declarations, or final submission. Official websites are not contacted by the default verification flow. Live official-site automation must only run after the user confirms the case facts and reporter profile.

Do not commit real evidence photos, generated case folders, reporter profiles, or personal data. The repository ignores `test-files/`, `cases/`, and `node_modules/`.

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
```

Prepare a submission packet:

```sh
npm run prepare:submission -- cases/<case-id>/draft.json
```

Generate guarded automation plans:

```sh
npm run taipei:dry-run -- cases/<case-id>/submission-packet.json
npm run new-taipei:dry-run -- cases/<case-id>/submission-packet.json
```

Run local browser fixture fills:

```sh
npm run fixture:fill -- cases/<case-id>/submission-packet.json --jurisdiction taipei
npm run fixture:fill -- cases/<case-id>/submission-packet.json --jurisdiction new_taipei
```

Write and update case records:

```sh
npm run write:case-record -- cases/<case-id>/draft.json cases/<case-id>/submission-packet.json cases/<case-id>/taipei-automation-plan.json
npm run update:case-record -- cases/<case-id>/case-record.json --case-number TP123456 --lookup-password "manual-password" --submitted-at 2026-06-16T12:00:00+08:00 --submission-status submitted_by_user
npm run list:cases
```

End-to-end local verification with `test-files/`:

```sh
npm run verify:test-files
```

## Current Limits

- The generated PNG submission files are visually rendered and metadata is preserved in draft sidecar data. Full EXIF embedding into PNG/JPEG still requires a future `exiftool` integration.
- GPS is only a starting point. The exact district, road, address note, and direction must be confirmed by the user.
- Live official-site automation is guarded and should not proceed until real case data and reporter profile fields are complete.
- Final submission remains manual.
