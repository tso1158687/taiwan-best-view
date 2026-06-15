#!/usr/bin/env node
import { commandExists, pathExists } from "./lib/system.mjs";
import { collectHeicInputs, convertHeicOne } from "./lib/heic-conversion.mjs";

function usage() {
  console.log("Usage: node scripts/convert-heic.mjs <input-file-or-directory> [output-directory]");
  console.log("");
  console.log("Converts HEIC/HEIF files to official-site-compatible PNG using macOS QuickLook.");
  console.log("Metadata is preserved in the generated draft sidecar data; exiftool can additionally embed metadata.");
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || inputArg === "--help" || inputArg === "-h") {
    usage();
    return;
  }

  if (!(await pathExists(inputArg))) {
    throw new Error(`Input does not exist: ${inputArg}`);
  }

  if (!(await commandExists("qlmanage"))) {
    throw new Error("macOS qlmanage is required for HEIC image rendering.");
  }

  const hasExiftool = await commandExists("exiftool");
  const inputs = await collectHeicInputs(inputArg);
  if (inputs.length === 0) {
    console.log("No HEIC/HEIF files found.");
    return;
  }

  const results = [];
  for (const input of inputs) {
    results.push(await convertHeicOne(input, outputArg, { hasExiftool }));
  }

  console.log(JSON.stringify({ hasExiftool, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
