#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createSubmissionPacket } from "./lib/submission-packet.mjs";
import { readReporterProfile } from "./lib/reporter-profile.mjs";

function usage() {
  console.log("Usage: node scripts/prepare-submission.mjs <case-draft.json> [reporter-profile.json]");
  console.log("");
  console.log("Writes submission-packet.json next to the draft. Does not contact official websites.");
  console.log("Encrypted reporter profiles require REPORTER_PROFILE_PASSPHRASE.");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const [, , draftArg, reporterArg] = process.argv;
  if (!draftArg || draftArg === "--help" || draftArg === "-h") {
    usage();
    return;
  }

  const draftPath = resolve(draftArg);
  const reporterProfile = reporterArg ? await readReporterProfile(resolve(reporterArg)) : null;
  const draft = await readJson(draftPath);
  const packet = await createSubmissionPacket({ draft, reporterProfile });
  const outputPath = join(dirname(draftPath), "submission-packet.json");

  await writeFile(outputPath, `${JSON.stringify(packet, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    status: packet.status,
    jurisdiction: packet.jurisdiction,
    officialUrl: packet.official.url,
    missing: packet.missing,
    attachmentCount: packet.attachments.length,
    stopBefore: packet.official.stopBefore,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
