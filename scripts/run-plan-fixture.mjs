#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { runPlanFixture } from "./lib/browser-fixture-runner.mjs";

function usage() {
  console.log("Usage: node scripts/run-plan-fixture.mjs <submission-packet.json> <automation-plan.json> [--jurisdiction taipei|new_taipei]");
  console.log("");
  console.log("Runs a local Playwright browser fixture following the guarded automation plan until the first human stop. It does not contact official websites or submit forms.");
}

function parseArgs(argv) {
  const result = {
    packetArg: argv[2],
    planArg: argv[3],
    jurisdiction: "",
  };

  for (let index = 4; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--jurisdiction") {
      result.jurisdiction = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

async function main() {
  const { packetArg, planArg, jurisdiction: jurisdictionArg } = parseArgs(process.argv);
  if (!packetArg || packetArg === "--help" || packetArg === "-h" || !planArg) {
    usage();
    return;
  }

  const packetPath = resolve(packetArg);
  const planPath = resolve(planArg);
  const packet = JSON.parse(await readFile(packetPath, "utf8"));
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const jurisdiction = jurisdictionArg || plan.jurisdiction || packet.jurisdiction;

  if (packet.jurisdiction !== jurisdiction || plan.jurisdiction !== jurisdiction) {
    throw new Error(`Jurisdiction mismatch: packet=${packet.jurisdiction}, plan=${plan.jurisdiction}, requested=${jurisdiction}`);
  }

  const outputPath = join(dirname(planPath), `${jurisdiction.replace("_", "-")}-plan-fixture-report.json`);
  const report = await runPlanFixture({ jurisdiction, packet, plan, outputPath });

  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    status: report.status,
    stoppedAtStepId: report.stoppedAtStepId,
    filledFieldCount: report.filledFieldCount,
    uploadedAttachmentCount: report.uploadedAttachmentCount,
    finalSubmitTriggered: report.finalSubmitTriggered,
    officialUrlContacted: report.officialUrlContacted,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
