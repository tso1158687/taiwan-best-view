#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createNewTaipeiAutomationPlan } from "./lib/new-taipei-automation-plan.mjs";

function usage() {
  console.log("Usage: node scripts/new-taipei-dry-run.mjs <submission-packet.json>");
  console.log("");
  console.log("Writes new-taipei-automation-plan.json next to the packet. Does not open or submit to official websites.");
}

async function main() {
  const [, , packetArg] = process.argv;
  if (!packetArg || packetArg === "--help" || packetArg === "-h") {
    usage();
    return;
  }

  const packetPath = resolve(packetArg);
  const packet = JSON.parse(await readFile(packetPath, "utf8"));
  const plan = createNewTaipeiAutomationPlan(packet);
  const outputPath = join(dirname(packetPath), "new-taipei-automation-plan.json");

  await writeFile(outputPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    status: plan.status,
    officialUrl: plan.officialUrl,
    missingCaseFields: plan.missingCaseFields,
    missingReporterFields: plan.missingReporterFields,
    dryRunOnly: plan.safety.dryRunOnly,
    manualStopCount: plan.steps.filter((item) => item.requiresHuman).length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
