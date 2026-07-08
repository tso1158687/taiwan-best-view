import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "./system.mjs";
import { validateCaseDraft } from "./case-draft-validation.mjs";

const ARTIFACTS = [
  { id: "draft", file: "draft.json", title: "Case draft" },
  { id: "processing_report", file: "processing-report.json", title: "Processing report" },
  { id: "submission_packet", file: "submission-packet.json", title: "Submission packet" },
  { id: "readiness_report", file: "case-readiness-report.json", title: "Readiness report" },
  { id: "readiness_checklist", file: "case-readiness-checklist.md", title: "Readiness checklist" },
  { id: "case_record", file: "case-record.json", title: "Case record" },
  { id: "case_record_summary", file: "case-record-summary.md", title: "Case record summary" },
];

async function readJsonIfExists(path) {
  if (!(await pathExists(path))) return null;
  return JSON.parse(await readFile(path, "utf8"));
}

async function artifactStatus(caseDirectory, artifact) {
  const path = join(caseDirectory, artifact.file);
  return {
    ...artifact,
    path,
    status: await pathExists(path) ? "present" : "missing",
  };
}

function automationPlanArtifact(jurisdiction) {
  if (jurisdiction === "new_taipei") {
    return {
      id: "automation_plan",
      file: "new-taipei-automation-plan.json",
      title: "New Taipei automation plan",
    };
  }
  return {
    id: "automation_plan",
    file: "taipei-automation-plan.json",
    title: "Taipei automation plan",
  };
}

function statusOrMissing(value) {
  return value || "missing";
}

function officialPreflightFile(jurisdiction) {
  return jurisdiction === "new_taipei"
    ? "new-taipei-live-preflight.json"
    : "taipei-live-preflight.json";
}

function commandHints({ caseDirectory, jurisdiction, artifacts }) {
  const commands = [];
  const has = (id) => artifacts.some((artifact) => artifact.id === id && artifact.status === "present");
  const draftPath = `${caseDirectory}/draft.json`;
  const packetPath = `${caseDirectory}/submission-packet.json`;
  const readinessPath = `${caseDirectory}/case-readiness-report.json`;

  if (!has("draft")) return commands;
  commands.push(`npm run validate:case-draft -- ${draftPath}`);
  if (!has("submission_packet")) {
    commands.push(`npm run prepare:submission -- ${draftPath} reporter-profile.local.json`);
  }
  if (!has("readiness_report")) {
    commands.push(`npm run review:case -- ${draftPath} reporter-profile.local.json --official-preflight cases/${officialPreflightFile(jurisdiction)}`);
  }
  if (!has("automation_plan") && has("submission_packet")) {
    commands.push(jurisdiction === "new_taipei"
      ? `npm run new-taipei:dry-run -- ${packetPath}`
      : `npm run taipei:dry-run -- ${packetPath}`);
  }
  if (has("automation_plan") && has("readiness_report")) {
    const planFile = jurisdiction === "new_taipei" ? "new-taipei-automation-plan.json" : "taipei-automation-plan.json";
    const script = jurisdiction === "new_taipei" ? "new-taipei:prototype" : "taipei:prototype";
    commands.push(`npm run ${script} -- ${caseDirectory}/${planFile} --readiness-report ${readinessPath} --allow-network`);
  }
  if (!has("case_record") && has("submission_packet")) {
    const planFile = jurisdiction === "new_taipei" ? "new-taipei-automation-plan.json" : "taipei-automation-plan.json";
    commands.push(`npm run write:case-record -- ${draftPath} ${packetPath} ${caseDirectory}/${planFile}`);
  }
  if (has("case_record") && !has("case_record_summary")) {
    commands.push(`npm run export:case-record -- ${caseDirectory}/case-record.json`);
  }

  return commands;
}

export async function createCaseWorkflowChecklist({ caseDirectory }) {
  const draftPath = join(caseDirectory, "draft.json");
  const draft = await readJsonIfExists(draftPath);
  const jurisdiction = draft?.jurisdiction || "taipei";
  const artifacts = [];

  for (const artifact of [...ARTIFACTS, automationPlanArtifact(jurisdiction)]) {
    artifacts.push(await artifactStatus(caseDirectory, artifact));
  }

  const draftValidation = draft
    ? validateCaseDraft(draft)
    : { status: "missing", issues: ["draft.missing"] };
  const packet = await readJsonIfExists(join(caseDirectory, "submission-packet.json"));
  const readiness = await readJsonIfExists(join(caseDirectory, "case-readiness-report.json"));
  const record = await readJsonIfExists(join(caseDirectory, "case-record.json"));

  return {
    generatedAt: new Date().toISOString(),
    caseDirectory,
    caseId: draft?.caseId || "",
    jurisdiction,
    draftValidation,
    statuses: {
      submissionPacket: statusOrMissing(packet?.status),
      readinessReport: statusOrMissing(readiness?.status),
      canOpenOfficialSiteForHumanReview: readiness?.canOpenOfficialSiteForHumanReview === true,
      caseRecord: statusOrMissing(record?.submissionStatus),
      automation: statusOrMissing(record?.automationStatus),
    },
    artifacts,
    nextCommands: commandHints({ caseDirectory, jurisdiction, artifacts }),
  };
}

export function formatCaseWorkflowChecklistMarkdown(checklist) {
  return [
    "# Case Workflow Checklist",
    "",
    `- Case ID: ${checklist.caseId || "-"}`,
    `- Jurisdiction: ${checklist.jurisdiction || "-"}`,
    `- Case directory: ${checklist.caseDirectory}`,
    `- Draft validation: ${checklist.draftValidation.status}`,
    `- Submission packet: ${checklist.statuses.submissionPacket}`,
    `- Readiness report: ${checklist.statuses.readinessReport}`,
    `- Can open official site for human review: ${checklist.statuses.canOpenOfficialSiteForHumanReview ? "yes" : "no"}`,
    `- Case record: ${checklist.statuses.caseRecord}`,
    `- Automation: ${checklist.statuses.automation}`,
    "",
    "## Artifacts",
    "",
    ...checklist.artifacts.map((artifact) => `- [${artifact.status === "present" ? "x" : " "}] ${artifact.title}: ${artifact.file}`),
    "",
    "## Draft Issues",
    "",
    ...(checklist.draftValidation.issues.length > 0
      ? checklist.draftValidation.issues.map((issue) => `- ${issue}`)
      : ["- -"]),
    "",
    "## Next Commands",
    "",
    ...(checklist.nextCommands.length > 0
      ? checklist.nextCommands.map((command) => `- \`${command}\``)
      : ["- -"]),
    "",
  ].join("\n");
}
