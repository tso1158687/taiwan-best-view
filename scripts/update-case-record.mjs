#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { updateCaseRecord } from "./lib/case-records.mjs";

function usage() {
  console.log("Usage: node scripts/update-case-record.mjs <case-record.json> [options]");
  console.log("");
  console.log("Options:");
  console.log("  --case-number <value>");
  console.log("  --lookup-password <value>");
  console.log("  --submitted-at <ISO datetime>");
  console.log("  --correction-status <value>");
  console.log("  --local-status <value>");
  console.log("  --submission-status <value>");
}

function parseArgs(argv) {
  const result = {
    recordPath: argv[2],
    localStatus: "",
    submissionStatus: "",
    official: {},
  };

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1] || "";
    if (arg === "--case-number") result.official.caseNumber = value;
    else if (arg === "--lookup-password") result.official.lookupPassword = value;
    else if (arg === "--submitted-at") result.official.submittedAt = value;
    else if (arg === "--correction-status") result.official.correctionStatus = value;
    else if (arg === "--local-status") result.localStatus = value;
    else if (arg === "--submission-status") result.submissionStatus = value;
    else continue;
    index += 1;
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.recordPath || options.recordPath === "--help" || options.recordPath === "-h") {
    usage();
    return;
  }

  const recordPath = resolve(options.recordPath);
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  const updated = updateCaseRecord(record, options);
  await writeFile(recordPath, `${JSON.stringify(updated, null, 2)}\n`);

  console.log(JSON.stringify({
    outputPath: recordPath,
    caseId: updated.caseId,
    localStatus: updated.localStatus,
    submissionStatus: updated.submissionStatus,
    official: {
      caseNumber: updated.official.caseNumber,
      submittedAt: updated.official.submittedAt,
      correctionStatus: updated.official.correctionStatus,
      hasLookupPassword: Boolean(updated.official.lookupPassword),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
