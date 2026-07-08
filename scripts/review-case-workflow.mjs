#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  createCaseWorkflowChecklist,
  formatCaseWorkflowChecklistMarkdown,
} from "./lib/case-workflow-checklist.mjs";

function usage() {
  console.log("Usage: node scripts/review-case-workflow.mjs <cases/case-id> [--json output.json] [--markdown output.md]");
  console.log("");
  console.log("Reviews which local workflow artifacts exist and suggests the next safe commands.");
}

function parseArgs(argv) {
  const result = {
    caseDirectory: argv[2],
    jsonPath: "",
    markdownPath: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      result.jsonPath = argv[index + 1] || "";
      index += 1;
    } else if (arg === "--markdown") {
      result.markdownPath = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.caseDirectory || options.caseDirectory === "--help" || options.caseDirectory === "-h") {
    usage();
    return;
  }

  const caseDirectory = resolve(options.caseDirectory);
  const checklist = await createCaseWorkflowChecklist({ caseDirectory });
  const jsonPath = options.jsonPath
    ? resolve(options.jsonPath)
    : join(caseDirectory, "case-workflow-checklist.json");

  await writeFile(jsonPath, `${JSON.stringify(checklist, null, 2)}\n`);
  let markdownPath = "";
  if (options.markdownPath) {
    markdownPath = resolve(options.markdownPath);
    await writeFile(markdownPath, formatCaseWorkflowChecklistMarkdown(checklist));
  }

  console.log(JSON.stringify({
    outputPath: jsonPath,
    markdownPath,
    caseId: checklist.caseId,
    draftValidationStatus: checklist.draftValidation.status,
    submissionPacketStatus: checklist.statuses.submissionPacket,
    readinessReportStatus: checklist.statuses.readinessReport,
    nextCommandCount: checklist.nextCommands.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
