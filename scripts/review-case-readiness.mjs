#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createCaseReadinessReport } from "./lib/case-readiness.mjs";

function usage() {
  console.log("Usage: node scripts/review-case-readiness.mjs <case-draft.json> [reporter-profile.json] [--json output.json]");
  console.log("");
  console.log("Creates a local readiness report for human-reviewed official-site submission.");
  console.log("Does not contact official websites, bypass CAPTCHA, or submit anything.");
}

function parseArgs(argv) {
  const result = {
    draftPath: argv[2],
    reporterPath: "",
    jsonPath: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      result.jsonPath = argv[index + 1] || "";
      index += 1;
    } else if (!result.reporterPath) {
      result.reporterPath = arg;
    }
  }

  return result;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function commandHints({ draftPath, reporterPath, report }) {
  const reporterArg = reporterPath ? ` ${reporterPath}` : "";
  const caseDir = dirname(draftPath);
  const packetPath = join(caseDir, "submission-packet.json");
  const hints = [
    `npm run prepare:submission -- ${draftPath}${reporterArg}`,
  ];

  if (report.jurisdiction === "taipei") {
    hints.push(`npm run taipei:dry-run -- ${packetPath}`);
  } else if (report.jurisdiction === "new_taipei") {
    hints.push(`npm run new-taipei:dry-run -- ${packetPath}`);
  }

  return hints;
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.draftPath || options.draftPath === "--help" || options.draftPath === "-h") {
    usage();
    return;
  }

  const draftPath = resolve(options.draftPath);
  const reporterPath = options.reporterPath ? resolve(options.reporterPath) : "";
  const draft = await readJson(draftPath);
  const reporterProfile = reporterPath ? await readJson(reporterPath) : null;
  const report = await createCaseReadinessReport({ draft, reporterProfile, draftPath });
  const outputPath = options.jsonPath
    ? resolve(options.jsonPath)
    : join(dirname(draftPath), "case-readiness-report.json");
  const output = {
    ...report,
    commandHints: commandHints({ draftPath, reporterPath, report }),
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    outputPath,
    status: output.status,
    canOpenOfficialSiteForHumanReview: output.canOpenOfficialSiteForHumanReview,
    jurisdiction: output.jurisdiction,
    officialUrl: output.officialUrl,
    missing: output.missing.all,
    stopBefore: output.stopBefore,
    nextSteps: output.nextSteps,
    commandHints: output.commandHints,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
