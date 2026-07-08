#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  addConfirmedLocation,
  DEFAULT_CONFIRMED_LOCATIONS_PATH,
  readConfirmedLocationLibrary,
  writeConfirmedLocationLibrary,
} from "./lib/confirmed-locations.mjs";

function usage() {
  console.log("Usage: node scripts/record-confirmed-location.mjs <case-draft.json> [confirmed-locations.local.json]");
  console.log("");
  console.log("Records a user-confirmed district, road, and address note into a local frequent-location library.");
  console.log("Keep the library private; it may reveal places you often report.");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function main() {
  const [, , draftArg, libraryArg] = process.argv;
  if (!draftArg || draftArg === "--help" || draftArg === "-h") {
    usage();
    return;
  }

  const draftPath = resolve(draftArg);
  const libraryPath = resolve(libraryArg || DEFAULT_CONFIRMED_LOCATIONS_PATH);
  const draft = await readJson(draftPath);
  const library = await readConfirmedLocationLibrary(libraryPath);
  const result = addConfirmedLocation(library, draft);
  await writeConfirmedLocationLibrary(result.library, libraryPath);

  console.log(JSON.stringify({
    outputPath: libraryPath,
    action: result.action,
    locationCount: result.library.locations.length,
    location: {
      label: result.location.label,
      jurisdiction: result.location.jurisdiction,
      district: result.location.district,
      road: result.location.road,
      addressNote: result.location.addressNote,
      hasGps: typeof result.location.latitude === "number" && typeof result.location.longitude === "number",
      useCount: result.location.useCount,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
