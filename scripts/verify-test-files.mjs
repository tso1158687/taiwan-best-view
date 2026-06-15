#!/usr/bin/env node
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, run } from "./lib/system.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertFile(path) {
  assert(await pathExists(path), `Missing file: ${path}`);
  const fileStat = await stat(path);
  assert(fileStat.size > 0, `File is empty: ${path}`);
}

async function main() {
  assert(await pathExists("test-files"), "Missing test-files directory.");

  const { stdout } = await run("npm", ["run", "create:case", "--", "test-files", "--jurisdiction", "taipei"]);
  const jsonStart = stdout.indexOf("{");
  assert(jsonStart >= 0, "create:case did not print JSON report.");

  const report = JSON.parse(stdout.slice(jsonStart));
  assert(report.inputCount === 2, `Expected 2 inputs, got ${report.inputCount}.`);
  assert(report.submissionFiles.length === 2, "Expected 2 submission files.");
  assert(report.occurredAtCandidate === "2026-06-12T15:32:11+08:00", "Unexpected occurred-at candidate.");
  assert(report.locationAssistance.status === "needs_review", "Expected location assistance to need review.");
  assert(report.locationAssistance.candidates.length >= 1, "Expected at least one GPS candidate.");
  assert(report.locationAssistance.missingGpsAttachments.includes("IMG_2630.HEIC"), "Expected IMG_2630.HEIC to be listed as missing GPS.");

  for (const fileName of report.submissionFiles) {
    await assertFile(join(report.caseDirectory, "converted", fileName));
  }

  const converted = report.attachments.filter((attachment) => attachment.conversionStatus === "converted");
  assert(converted.length === 2, "Expected both HEIC files to be converted.");
  assert(report.attachments.some((attachment) => attachment.gpsStatus === "present"), "Expected one attachment with GPS.");
  assert(report.attachments.some((attachment) => attachment.gpsStatus === "missing"), "Expected one attachment missing GPS.");

  console.log(JSON.stringify({
    ok: true,
    caseDirectory: report.caseDirectory,
    occurredAtCandidate: report.occurredAtCandidate,
    locationCandidates: report.locationAssistance.candidates.length,
    missingGpsAttachments: report.locationAssistance.missingGpsAttachments,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
