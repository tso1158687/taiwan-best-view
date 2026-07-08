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

function planFixtureArtifact(jurisdiction) {
  if (jurisdiction === "new_taipei") {
    return {
      id: "plan_fixture_report",
      file: "new-taipei-plan-fixture-report.json",
      title: "New Taipei plan fixture report",
    };
  }
  return {
    id: "plan_fixture_report",
    file: "taipei-plan-fixture-report.json",
    title: "Taipei plan fixture report",
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
    commands.push(planFixtureCommand({ caseDirectory, jurisdiction }));
    commands.push(prototypeCommand({ caseDirectory, jurisdiction }));
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

function artifactPresent(artifacts, id) {
  return artifacts.some((artifact) => artifact.id === id && artifact.status === "present");
}

function prototypeCommand({ caseDirectory, jurisdiction }) {
  const planFile = jurisdiction === "new_taipei" ? "new-taipei-automation-plan.json" : "taipei-automation-plan.json";
  const planFixtureFile = jurisdiction === "new_taipei" ? "new-taipei-plan-fixture-report.json" : "taipei-plan-fixture-report.json";
  const script = jurisdiction === "new_taipei" ? "new-taipei:prototype" : "taipei:prototype";
  return `npm run ${script} -- ${caseDirectory}/${planFile} --readiness-report ${caseDirectory}/case-readiness-report.json --plan-fixture-report ${caseDirectory}/${planFixtureFile} --allow-network`;
}

function planFixtureCommand({ caseDirectory, jurisdiction }) {
  const planFile = jurisdiction === "new_taipei" ? "new-taipei-automation-plan.json" : "taipei-automation-plan.json";
  return `npm run fixture:plan -- ${caseDirectory}/submission-packet.json ${caseDirectory}/${planFile}`;
}

function dryRunCommand({ caseDirectory, jurisdiction }) {
  const packetPath = `${caseDirectory}/submission-packet.json`;
  return jurisdiction === "new_taipei"
    ? `npm run new-taipei:dry-run -- ${packetPath}`
    : `npm run taipei:dry-run -- ${packetPath}`;
}

function recommendedNextAction({ caseDirectory, jurisdiction, artifacts, draftValidation, packet, readiness, record }) {
  const draftPath = `${caseDirectory}/draft.json`;
  const packetPath = `${caseDirectory}/submission-packet.json`;
  const preflightPath = `cases/${officialPreflightFile(jurisdiction)}`;
  const has = (id) => artifactPresent(artifacts, id);

  if (!has("draft")) {
    return {
      id: "create_case",
      title: "Create a case draft",
      reason: "This case folder does not contain draft.json yet.",
      command: "npm run create:case -- test-files --jurisdiction taipei",
      requiresHuman: true,
    };
  }

  if (draftValidation.status !== "ok") {
    return {
      id: "fix_case_draft",
      title: "Fix the case draft",
      reason: "draft.json exists but does not pass local schema validation.",
      command: `npm run validate:case-draft -- ${draftPath}`,
      requiresHuman: true,
    };
  }

  if (!has("submission_packet")) {
    return {
      id: "prepare_submission_packet",
      title: "Prepare the submission packet",
      reason: "The draft is valid, but submission-packet.json has not been generated.",
      command: `npm run prepare:submission -- ${draftPath} reporter-profile.local.json`,
      requiresHuman: false,
    };
  }

  if (packet?.status === "needs_missing_data") {
    return {
      id: "fill_missing_data",
      title: "Fill missing case or reporter fields",
      reason: `The submission packet is missing ${packet.missing?.length || 0} required field(s).`,
      command: `npm run prepare:submission -- ${draftPath} reporter-profile.local.json`,
      requiresHuman: true,
    };
  }

  if (!has("readiness_report")) {
    return {
      id: "review_case_readiness",
      title: "Run the readiness review",
      reason: "The submission packet is ready, but the guarded official-site readiness report is missing.",
      command: `npm run review:case -- ${draftPath} reporter-profile.local.json --official-preflight ${preflightPath}`,
      requiresHuman: false,
    };
  }

  if (readiness?.status === "needs_missing_data") {
    return {
      id: "resolve_readiness_missing_data",
      title: "Resolve readiness missing data",
      reason: "The readiness report still blocks official-site opening because case or reporter data is incomplete.",
      command: `npm run review:case -- ${draftPath} reporter-profile.local.json --official-preflight ${preflightPath}`,
      requiresHuman: true,
    };
  }

  if (readiness?.status === "needs_official_preflight") {
    return {
      id: "refresh_official_preflight",
      title: "Refresh the official-site preflight",
      reason: "Local data is complete, but a fresh matching read-only official preflight is required before opening the guarded browser.",
      command: `npm run official:preflight -- ${jurisdiction} --allow-network --json ${preflightPath}`,
      requiresHuman: true,
    };
  }

  if (!has("automation_plan")) {
    return {
      id: "create_automation_plan",
      title: "Create the guarded automation plan",
      reason: "The case is locally reviewed, but the dry-run automation plan has not been generated.",
      command: dryRunCommand({ caseDirectory, jurisdiction }),
      requiresHuman: false,
    };
  }

  if (!has("case_record")) {
    const planFile = jurisdiction === "new_taipei" ? "new-taipei-automation-plan.json" : "taipei-automation-plan.json";
    return {
      id: "write_case_record",
      title: "Write the local case record",
      reason: "The guarded plan exists, but this case does not have a local case-record.json yet.",
      command: `npm run write:case-record -- ${draftPath} ${packetPath} ${caseDirectory}/${planFile}`,
      requiresHuman: false,
    };
  }

  if (!has("plan_fixture_report")) {
    return {
      id: "verify_guarded_plan_fixture",
      title: "Verify the guarded plan locally",
      reason: "Before opening the official website, run the guarded automation plan against the local official-like fixture and confirm it stops at the first human gate.",
      command: planFixtureCommand({ caseDirectory, jurisdiction }),
      requiresHuman: false,
    };
  }

  if (record?.submissionStatus !== "submitted_by_user" && readiness?.canOpenOfficialSiteForHumanReview === true) {
    return {
      id: "open_guarded_browser",
      title: "Open the guarded browser flow",
      reason: "The case is ready for human-reviewed official-site entry. CAPTCHA, Email verification, declarations, and final submit remain manual.",
      command: prototypeCommand({ caseDirectory, jurisdiction }),
      requiresHuman: true,
    };
  }

  if (record?.submissionStatus !== "submitted_by_user") {
    return {
      id: "wait_for_manual_submission",
      title: "Record manual submission details",
      reason: "A case record exists, but official submission has not been marked as completed by the user.",
      command: `npm run update:case-record -- ${caseDirectory}/case-record.json --case-number <official-case-number> --submitted-at <ISO datetime> --submission-status submitted_by_user --local-status submitted`,
      requiresHuman: true,
    };
  }

  if (!has("case_record_summary")) {
    return {
      id: "export_case_record_summary",
      title: "Export the case record summary",
      reason: "The case is marked as manually submitted, but the human-readable archive summary is missing.",
      command: `npm run export:case-record -- ${caseDirectory}/case-record.json`,
      requiresHuman: false,
    };
  }

  return {
    id: "workflow_complete",
    title: "Workflow is locally complete",
    reason: "The local artifacts, manual submission record, and archive summary are present.",
    command: "",
    requiresHuman: false,
  };
}

export async function createCaseWorkflowChecklist({ caseDirectory }) {
  const draftPath = join(caseDirectory, "draft.json");
  const draft = await readJsonIfExists(draftPath);
  const jurisdiction = draft?.jurisdiction || "taipei";
  const artifacts = [];

  for (const artifact of [...ARTIFACTS, automationPlanArtifact(jurisdiction), planFixtureArtifact(jurisdiction)]) {
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
      planFixture: artifacts.find((artifact) => artifact.id === "plan_fixture_report")?.status || "missing",
    },
    artifacts,
    nextAction: recommendedNextAction({ caseDirectory, jurisdiction, artifacts, draftValidation, packet, readiness, record }),
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
    `- Plan fixture: ${checklist.statuses.planFixture}`,
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
    "## Recommended Next Action",
    "",
    `- ID: ${checklist.nextAction?.id || "-"}`,
    `- Title: ${checklist.nextAction?.title || "-"}`,
    `- Reason: ${checklist.nextAction?.reason || "-"}`,
    `- Requires human: ${checklist.nextAction?.requiresHuman ? "yes" : "no"}`,
    `- Command: ${checklist.nextAction?.command ? `\`${checklist.nextAction.command}\`` : "-"}`,
    "",
    "## Next Commands",
    "",
    ...(checklist.nextCommands.length > 0
      ? checklist.nextCommands.map((command) => `- \`${command}\``)
      : ["- -"]),
    "",
  ].join("\n");
}
