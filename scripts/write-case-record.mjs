#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createCaseRecord } from "./lib/case-records.mjs";
import { pathExists } from "./lib/system.mjs";

function usage() {
  console.log("Usage: node scripts/write-case-record.mjs <draft.json> [submission-packet.json] [automation-plan.json]");
  console.log("");
  console.log("Writes case-record.json next to the draft.");
}

async function readJsonIfPresent(path) {
  if (!path) return null;
  if (!(await pathExists(path))) return null;
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const [, , draftArg, packetArg, planArg] = process.argv;
  if (!draftArg || draftArg === "--help" || draftArg === "-h") {
    usage();
    return;
  }

  const draftPath = resolve(draftArg);
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  const record = createCaseRecord({
    draft,
    submissionPacket: await readJsonIfPresent(packetArg ? resolve(packetArg) : ""),
    automationPlan: await readJsonIfPresent(planArg ? resolve(planArg) : ""),
  });
  const outputPath = join(dirname(draftPath), "case-record.json");
  await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, status: record.submissionStatus, automationStatus: record.automationStatus }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
