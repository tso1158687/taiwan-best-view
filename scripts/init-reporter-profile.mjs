#!/usr/bin/env node
import { copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathExists } from "./lib/system.mjs";

function usage() {
  console.log("Usage: node scripts/init-reporter-profile.mjs [output-path]");
  console.log("");
  console.log("Creates a local reporter profile template. Keep the output file private and do not commit it.");
}

async function main() {
  const [, , outputArg] = process.argv;
  if (outputArg === "--help" || outputArg === "-h") {
    usage();
    return;
  }

  const outputPath = resolve(outputArg || "reporter-profile.local.json");
  if (await pathExists(outputPath)) {
    throw new Error(`Refusing to overwrite existing reporter profile: ${outputPath}`);
  }

  await copyFile(resolve("reporter-profile.example.json"), outputPath);
  console.log(JSON.stringify({
    outputPath,
    status: "created",
    private: true,
    nextStep: "Fill the JSON locally, validate it, then optionally encrypt it with npm run encrypt:reporter-profile -- <plain-path> <encrypted-path>.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
