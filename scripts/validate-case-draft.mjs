#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCaseDraft } from "./lib/case-draft-validation.mjs";

function usage() {
  console.log("Usage: node scripts/validate-case-draft.mjs <draft.json>");
  console.log("");
  console.log("Validates the local case draft structure without reading attachment files or contacting official websites.");
}

async function main() {
  const [, , draftArg] = process.argv;
  if (!draftArg || draftArg === "--help" || draftArg === "-h") {
    usage();
    return;
  }

  const draftPath = resolve(draftArg);
  const draft = JSON.parse(await readFile(draftPath, "utf8"));
  const result = validateCaseDraft(draft);
  console.log(JSON.stringify({
    draftPath,
    ...result,
  }, null, 2));
  if (result.status !== "ok") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
