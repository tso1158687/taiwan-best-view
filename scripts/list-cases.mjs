#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { summarizeCaseRecord } from "./lib/case-records.mjs";
import { pathExists } from "./lib/system.mjs";

function usage() {
  console.log("Usage: node scripts/list-cases.mjs [cases-directory] [--json <output.json>]");
  console.log("");
  console.log("Reads case-record.json files and prints a local case history summary.");
}

function parseArgs(argv) {
  const result = {
    casesDirectory: "cases",
    output: "",
  };

  let index = 2;
  if (argv[index] && !argv[index].startsWith("-")) {
    result.casesDirectory = argv[index];
    index += 1;
  }

  for (; index < argv.length; index += 1) {
    if (argv[index] === "--json") {
      result.output = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

async function readCaseSummaries(casesDirectory) {
  if (!(await pathExists(casesDirectory))) return [];

  const entries = await readdir(casesDirectory, { withFileTypes: true });
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const caseDirectory = join(casesDirectory, entry.name);
    const recordPath = join(caseDirectory, "case-record.json");
    if (!(await pathExists(recordPath))) continue;
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    summaries.push(summarizeCaseRecord(record, caseDirectory));
  }

  return summaries.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.casesDirectory === "--help" || options.casesDirectory === "-h") {
    usage();
    return;
  }

  const casesDirectory = resolve(options.casesDirectory);
  const cases = await readCaseSummaries(casesDirectory);
  const report = {
    generatedAt: new Date().toISOString(),
    casesDirectory,
    count: cases.length,
    cases,
  };

  if (options.output) {
    const outputPath = resolve(options.output);
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ outputPath, count: report.count }, null, 2));
    return;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
