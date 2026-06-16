#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createPrototypeRun, loadAutomationPlan } from "./lib/form-prototype.mjs";

function usage() {
  console.log("Usage: node scripts/new-taipei-prototype.mjs <new-taipei-automation-plan.json> [--allow-network]");
  console.log("");
  console.log("Runs a guarded New Taipei prototype preflight. It never submits, bypasses CAPTCHA/Email, or launches a browser unless --allow-network is provided.");
}

async function main() {
  const [, , planArg, ...rest] = process.argv;
  if (!planArg || planArg === "--help" || planArg === "-h") {
    usage();
    return;
  }

  const planPath = resolve(planArg);
  const plan = await loadAutomationPlan(planPath);
  if (plan.jurisdiction !== "new_taipei") {
    throw new Error(`New Taipei prototype cannot handle jurisdiction: ${plan.jurisdiction}`);
  }

  const result = await createPrototypeRun({
    plan,
    allowNetwork: rest.includes("--allow-network"),
  });
  const outputPath = join(dirname(planPath), "new-taipei-prototype-run.json");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ outputPath, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
