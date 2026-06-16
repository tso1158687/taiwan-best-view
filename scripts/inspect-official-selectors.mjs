#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getOfficialSelectorManifest, validateSelectorManifest } from "./lib/official-selector-manifests.mjs";

function usage() {
  console.log("Usage: node scripts/inspect-official-selectors.mjs <taipei|new_taipei> [--json <output.json>]");
  console.log("");
  console.log("Validates the local official selector manifest captured from public official-site pages.");
}

function parseArgs(argv) {
  const result = {
    jurisdiction: argv[2],
    output: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    if (argv[index] === "--json") {
      result.output = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.jurisdiction || options.jurisdiction === "--help" || options.jurisdiction === "-h") {
    usage();
    return;
  }

  const manifest = getOfficialSelectorManifest(options.jurisdiction);
  const validation = validateSelectorManifest(options.jurisdiction);
  const report = {
    generatedAt: new Date().toISOString(),
    validation,
    routes: manifest.routes,
    apiEndpoints: manifest.apiEndpoints,
    fields: manifest.fields,
    humanStops: manifest.humanStops,
  };

  if (options.output) {
    const outputPath = resolve(options.output);
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ outputPath, ...validation }, null, 2));
    return;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
