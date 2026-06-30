#!/usr/bin/env node
import { resolve } from "node:path";
import { readReporterProfile, summarizeReporterProfile } from "./lib/reporter-profile.mjs";

function usage() {
  console.log("Usage: node scripts/validate-reporter-profile.mjs <reporter-profile.json>");
  console.log("");
  console.log("Validates required reporter fields without printing personal data values.");
}

async function main() {
  const [, , profileArg] = process.argv;
  if (!profileArg || profileArg === "--help" || profileArg === "-h") {
    usage();
    return;
  }

  const profilePath = resolve(profileArg);
  const profile = await readReporterProfile(profilePath);
  const summary = summarizeReporterProfile(profile);

  console.log(JSON.stringify({
    profilePath,
    ...summary,
  }, null, 2));

  if (summary.status !== "ready") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
