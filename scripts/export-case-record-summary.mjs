#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { formatCaseRecordMarkdown } from "./lib/case-record-markdown.mjs";

function usage() {
  console.log("Usage: node scripts/export-case-record-summary.mjs <case-record.json> [--markdown output.md]");
  console.log("");
  console.log("Writes a human-readable case record summary without exposing the lookup password value.");
}

function parseArgs(argv) {
  const result = {
    recordPath: argv[2],
    markdownPath: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    if (argv[index] === "--markdown") {
      result.markdownPath = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.recordPath || options.recordPath === "--help" || options.recordPath === "-h") {
    usage();
    return;
  }

  const recordPath = resolve(options.recordPath);
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  const markdown = formatCaseRecordMarkdown(record);
  const outputPath = options.markdownPath
    ? resolve(options.markdownPath)
    : join(dirname(recordPath), "case-record-summary.md");

  await writeFile(outputPath, markdown);
  console.log(JSON.stringify({
    outputPath,
    caseId: record.caseId || "",
    submissionStatus: record.submissionStatus || "",
    official: {
      caseNumber: record.official?.caseNumber || "",
      submittedAt: record.official?.submittedAt || "",
      hasLookupPassword: Boolean(record.official?.lookupPassword),
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
