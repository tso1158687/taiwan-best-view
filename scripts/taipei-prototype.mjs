#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createPrototypeRun, loadAutomationPlan } from "./lib/form-prototype.mjs";

function usage() {
  console.log("Usage: node scripts/taipei-prototype.mjs <taipei-automation-plan.json> [--readiness-report case-readiness-report.json] [--plan-fixture-report taipei-plan-fixture-report.json] [--allow-network]");
  console.log("");
  console.log("Runs a guarded Taipei prototype preflight. It never submits, bypasses verification, or launches a browser unless --allow-network and a ready readiness report are provided.");
}

function parseArgs(argv) {
  const result = {
    planArg: argv[2],
    allowNetwork: false,
    readinessReportPath: "",
    planFixtureReportPath: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--allow-network") {
      result.allowNetwork = true;
    } else if (arg === "--readiness-report") {
      result.readinessReportPath = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--plan-fixture-report") {
      result.planFixtureReportPath = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

async function main() {
  const { planArg, allowNetwork, readinessReportPath, planFixtureReportPath } = parseArgs(process.argv);
  if (!planArg || planArg === "--help" || planArg === "-h") {
    usage();
    return;
  }

  const planPath = resolve(planArg);
  const plan = await loadAutomationPlan(planPath);
  if (plan.jurisdiction !== "taipei") {
    throw new Error(`Taipei prototype cannot handle jurisdiction: ${plan.jurisdiction}`);
  }
  const readinessReport = readinessReportPath
    ? JSON.parse(await readFile(resolve(readinessReportPath), "utf8"))
    : null;
  const planFixtureReport = planFixtureReportPath
    ? JSON.parse(await readFile(resolve(planFixtureReportPath), "utf8"))
    : null;

  const result = await createPrototypeRun({
    plan,
    allowNetwork,
    readinessReport,
    planFixtureReport,
  });
  const outputPath = join(dirname(planPath), "taipei-prototype-run.json");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
