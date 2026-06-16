#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, run } from "./lib/system.mjs";
import { readSipsMetadata } from "./lib/metadata.mjs";
import { createSubmissionPacket } from "./lib/submission-packet.mjs";
import { createTaipeiAutomationPlan } from "./lib/taipei-automation-plan.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertFile(path) {
  assert(await pathExists(path), `Missing file: ${path}`);
  const fileStat = await stat(path);
  assert(fileStat.size > 100000, `File is too small to be a rendered submission image: ${path}`);
  const metadata = await readSipsMetadata(path);
  assert(Number(metadata.pixelWidth) > 0, `Missing pixel width: ${path}`);
  assert(Number(metadata.pixelHeight) > 0, `Missing pixel height: ${path}`);
}

async function main() {
  assert(await pathExists("test-files"), "Missing test-files directory.");

  const { stdout } = await run("npm", ["run", "create:case", "--", "test-files", "--jurisdiction", "taipei"]);
  const jsonStart = stdout.indexOf("{");
  assert(jsonStart >= 0, "create:case did not print JSON report.");

  const report = JSON.parse(stdout.slice(jsonStart));
  assert(report.inputCount === 2, `Expected 2 inputs, got ${report.inputCount}.`);
  assert(report.submissionFiles.length === 2, "Expected 2 submission files.");
  assert(report.submissionFiles.every((fileName) => fileName.endsWith(".png")), "Expected QuickLook-rendered PNG submission files.");
  assert(report.occurredAtCandidate === "2026-06-12T15:32:11+08:00", "Unexpected occurred-at candidate.");
  assert(report.locationAssistance.status === "needs_review", "Expected location assistance to need review.");
  assert(report.locationAssistance.candidates.length >= 1, "Expected at least one GPS candidate.");
  assert(report.locationAssistance.missingGpsAttachments.includes("IMG_2630.HEIC"), "Expected IMG_2630.HEIC to be listed as missing GPS.");
  assert(report.photoAnalysis.status === "ok", "Expected OCR photo analysis to succeed.");
  assert(report.photoAnalysis.plateCandidates.length >= 1, "Expected at least one plate candidate.");
  assert(report.photoAnalysis.locationTextCandidates.length >= 1, "Expected at least one location text candidate.");
  assert(report.fieldSuggestions.status === "needs_review", "Expected field suggestions to need review.");
  assert(report.fieldSuggestions.plate.length >= 1, "Expected at least one plate field suggestion.");
  assert(report.fieldSuggestions.addressNote.length >= 1, "Expected at least one address note field suggestion.");

  for (const fileName of report.submissionFiles) {
    await assertFile(join(report.caseDirectory, "converted", fileName));
  }

  const converted = report.attachments.filter((attachment) => attachment.conversionStatus === "converted");
  assert(converted.length === 2, "Expected both HEIC files to be converted.");
  assert(converted.every((attachment) => attachment.exifStatus === "sidecar"), "Expected EXIF to be preserved in draft sidecar metadata.");
  assert(converted.every((attachment) => attachment.renderedWidth > 0 && attachment.renderedHeight > 0), "Expected rendered dimensions for both attachments.");
  assert(report.attachments.some((attachment) => attachment.gpsStatus === "present"), "Expected one attachment with GPS.");
  assert(report.attachments.some((attachment) => attachment.gpsStatus === "missing"), "Expected one attachment missing GPS.");

  const draft = JSON.parse(await readFile(join(report.caseDirectory, "draft.json"), "utf8"));
  const packet = await createSubmissionPacket({ draft });
  assert(packet.official.url === "https://prsweb.tcpd.gov.tw/", "Expected Taipei official URL.");
  assert(packet.attachments.length === 2, "Expected packet attachment count.");
  assert(packet.missing.includes("case.plate"), "Expected plate to remain missing until human confirmation.");
  assert(packet.missing.includes("reporter.name"), "Expected reporter data to remain missing.");
  assert(packet.official.stopBefore.includes("final_submit"), "Expected final submit stop boundary.");
  const taipeiPlan = createTaipeiAutomationPlan(packet);
  assert(taipeiPlan.status === "blocked_by_missing_data", "Expected Taipei dry run to be blocked by missing data.");
  assert(taipeiPlan.safety.dryRunOnly === true, "Expected Taipei plan to be dry-run only.");
  assert(taipeiPlan.safety.finalSubmit === false, "Expected Taipei plan to disable final submit.");
  assert(taipeiPlan.steps.some((item) => item.id === "stop_before_email_verification" && item.requiresHuman), "Expected email verification stop.");

  console.log(JSON.stringify({
    ok: true,
    caseDirectory: report.caseDirectory,
    occurredAtCandidate: report.occurredAtCandidate,
    locationCandidates: report.locationAssistance.candidates.length,
    missingGpsAttachments: report.locationAssistance.missingGpsAttachments,
    plateCandidates: report.photoAnalysis.plateCandidates.map((candidate) => candidate.text),
    locationTextCandidates: report.photoAnalysis.locationTextCandidates.map((candidate) => candidate.text),
    plateSuggestions: report.fieldSuggestions.plate.map((suggestion) => suggestion.value),
    addressNoteSuggestions: report.fieldSuggestions.addressNote.map((suggestion) => suggestion.value),
    submissionPacketStatus: packet.status,
    submissionPacketMissing: packet.missing,
    taipeiDryRunStatus: taipeiPlan.status,
    taipeiDryRunManualStops: taipeiPlan.steps.filter((item) => item.requiresHuman).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
