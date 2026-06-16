#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createReviewedPacketForFixture, runFixtureFill } from "./lib/browser-fixture-runner.mjs";

function usage() {
  console.log("Usage: node scripts/run-fixture-fill.mjs <submission-packet.json> [--jurisdiction taipei|new_taipei]");
  console.log("");
  console.log("Runs a local Playwright browser fill against an official-like fixture. It does not contact official websites or submit forms.");
}

function parseArgs(argv) {
  const result = {
    packetPath: argv[2],
    jurisdiction: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    if (argv[index] === "--jurisdiction") {
      result.jurisdiction = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.packetPath || options.packetPath === "--help" || options.packetPath === "-h") {
    usage();
    return;
  }

  const packetPath = resolve(options.packetPath);
  const packet = JSON.parse(await readFile(packetPath, "utf8"));
  const jurisdiction = options.jurisdiction || packet.jurisdiction;
  const reviewedPacket = await createReviewedPacketForFixture({ ...packet, jurisdiction });
  const outputPath = join(dirname(packetPath), `${jurisdiction.replace("_", "-")}-fixture-fill-report.json`);
  const report = await runFixtureFill({ jurisdiction, packet: reviewedPacket, outputPath });

  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    status: report.status,
    jurisdiction: report.jurisdiction,
    filledFieldCount: report.filledFieldCount,
    uploadedAttachmentCount: report.uploadedAttachmentCount,
    finalSubmitTriggered: report.finalSubmitTriggered,
    humanStopTriggered: report.humanStopTriggered,
    officialUrlContacted: report.officialUrlContacted,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
