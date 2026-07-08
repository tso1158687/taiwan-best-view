import { summarizeCorrection } from "./case-records.mjs";

function valueOrDash(value) {
  return value ? String(value) : "-";
}

function boolLabel(value) {
  return value ? "yes" : "no";
}

function listLines(items) {
  if (!items || items.length === 0) return ["- -"];
  return items.map((item) => `- ${item}`);
}

export function formatCaseRecordMarkdown(record) {
  const official = record.official || {};
  const correction = summarizeCorrection(record);
  const attachments = record.attachmentSummary || [];
  const missing = record.missing || [];
  const humanStops = record.requiredHumanStops || [];

  return [
    "# Case Record Summary",
    "",
    "## Case",
    "",
    `- Case ID: ${valueOrDash(record.caseId)}`,
    `- Jurisdiction: ${valueOrDash(record.jurisdiction)}`,
    `- Violation type: ${valueOrDash(record.violationType)}`,
    `- Created at: ${valueOrDash(record.createdAt)}`,
    `- Updated at: ${valueOrDash(record.updatedAt)}`,
    "",
    "## Workflow Status",
    "",
    `- Local status: ${valueOrDash(record.localStatus)}`,
    `- Submission status: ${valueOrDash(record.submissionStatus)}`,
    `- Automation status: ${valueOrDash(record.automationStatus)}`,
    `- Missing field count: ${missing.length}`,
    `- Required human stop count: ${humanStops.length}`,
    "",
    "## Official Receipt",
    "",
    `- Official URL: ${valueOrDash(official.url)}`,
    `- Case number: ${valueOrDash(official.caseNumber)}`,
    `- Submitted at: ${valueOrDash(official.submittedAt)}`,
    `- Correction status: ${valueOrDash(correction.status)}`,
    `- Correction received at: ${valueOrDash(correction.receivedAt)}`,
    `- Correction due at: ${valueOrDash(correction.dueAt)}`,
    `- Correction note: ${valueOrDash(correction.note)}`,
    `- Lookup password stored in JSON: ${boolLabel(Boolean(official.lookupPassword))}`,
    "",
    "## Correction Items",
    "",
    ...listLines(correction.items),
    "",
    "## Required Human Stops",
    "",
    ...listLines(humanStops),
    "",
    "## Missing Fields",
    "",
    ...listLines(missing),
    "",
    "## Attachments",
    "",
    ...(
      attachments.length === 0
        ? ["- -"]
        : attachments.map((attachment) => [
            `- ${valueOrDash(attachment.submissionName)}`,
            `  - Original: ${valueOrDash(attachment.originalName)}`,
            `  - Conversion: ${valueOrDash(attachment.conversionStatus)}`,
            `  - EXIF: ${valueOrDash(attachment.exifStatus)}`,
            `  - GPS: ${valueOrDash(attachment.gpsStatus)}`,
            `  - Size: ${valueOrDash(attachment.size)}`,
          ].join("\n"))
    ),
    "",
    "## Notes",
    "",
    ...listLines(record.notes || []),
    "",
  ].join("\n");
}
