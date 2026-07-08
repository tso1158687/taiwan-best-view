import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { validateSelectorManifest } from "./official-selector-manifests.mjs";

const require = createRequire(import.meta.url);

function packageAvailable(packageName) {
  try {
    require.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}

function manualStopIds(plan) {
  return (plan.steps || [])
    .filter((step) => step.requiresHuman)
    .map((step) => step.id);
}

function blockedSteps(plan) {
  return (plan.steps || [])
    .filter((step) => step.status === "blocked")
    .map((step) => ({
      id: step.id,
      reason: step.stopReason,
    }));
}

function readyStepsBeforeHumanStop(plan) {
  const ready = [];
  for (const step of plan.steps || []) {
    if (step.requiresHuman || step.action === "stop") break;
    if (step.status === "ready") ready.push(step.id);
  }
  return ready;
}

function firstHumanStop(plan) {
  return (plan.steps || []).find((step) => step.requiresHuman || step.action === "stop") || null;
}

export async function loadAutomationPlan(planPath) {
  return JSON.parse(await readFile(planPath, "utf8"));
}

function summarizeReadinessReport({ plan, readinessReport }) {
  if (!readinessReport) {
    return {
      status: "not_provided",
      jurisdiction: "",
      officialUrl: "",
      canOpenOfficialSiteForHumanReview: false,
      officialPreflightStatus: "not_provided",
      issues: ["readiness_report.missing"],
    };
  }

  const officialPreflightStatus = readinessReport.officialPreflight?.status || "not_provided";
  const issues = [];
  if (readinessReport.jurisdiction !== plan.jurisdiction) {
    issues.push("readiness_report.jurisdiction_mismatch");
  }
  if (readinessReport.officialUrl !== plan.officialUrl) {
    issues.push("readiness_report.official_url_mismatch");
  }
  if (readinessReport.status !== "ready_for_human_review") {
    issues.push("readiness_report.not_ready");
  }
  if (readinessReport.canOpenOfficialSiteForHumanReview !== true) {
    issues.push("readiness_report.official_site_not_allowed");
  }
  if (officialPreflightStatus !== "ok") {
    issues.push("readiness_report.official_preflight_not_ok");
  }

  return {
    status: issues.length === 0 ? "ok" : "needs_recheck",
    reportStatus: readinessReport.status || "",
    jurisdiction: readinessReport.jurisdiction || "",
    officialUrl: readinessReport.officialUrl || "",
    canOpenOfficialSiteForHumanReview: readinessReport.canOpenOfficialSiteForHumanReview === true,
    officialPreflightStatus,
    issues,
  };
}

function summarizePlanFixtureReport({ plan, planFixtureReport }) {
  const expectedStop = firstHumanStop(plan);
  if (!planFixtureReport) {
    return {
      status: "not_provided",
      jurisdiction: "",
      stoppedAtStepId: "",
      issues: ["plan_fixture_report.missing"],
    };
  }

  const issues = [];
  if (planFixtureReport.jurisdiction !== plan.jurisdiction) {
    issues.push("plan_fixture_report.jurisdiction_mismatch");
  }
  if (planFixtureReport.status !== "stopped_at_human_gate") {
    issues.push("plan_fixture_report.not_stopped_at_human_gate");
  }
  if (expectedStop?.id && planFixtureReport.stoppedAtStepId !== expectedStop.id) {
    issues.push("plan_fixture_report.first_stop_mismatch");
  }
  if (planFixtureReport.finalSubmitTriggered !== false) {
    issues.push("plan_fixture_report.final_submit_triggered");
  }
  if (planFixtureReport.humanStopTriggered !== false) {
    issues.push("plan_fixture_report.human_stop_clicked");
  }
  if (planFixtureReport.officialUrlContacted !== false) {
    issues.push("plan_fixture_report.official_url_contacted");
  }

  return {
    status: issues.length === 0 ? "ok" : "needs_recheck",
    jurisdiction: planFixtureReport.jurisdiction || "",
    stoppedAtStepId: planFixtureReport.stoppedAtStepId || "",
    expectedFirstHumanStopId: expectedStop?.id || "",
    issues,
  };
}

function createGuardedHandoff({ plan, readinessGate, planFixtureGate }) {
  const stop = firstHumanStop(plan);
  return {
    status: readinessGate.status === "ok" && planFixtureGate.status === "ok" ? "ready" : "not_ready",
    officialUrl: plan.officialUrl,
    firstHumanStop: stop
      ? {
          id: stop.id,
          title: stop.title,
          action: stop.action,
          stopReason: stop.stopReason,
        }
      : null,
    readyStepsBeforeFirstHumanStop: readyStepsBeforeHumanStop(plan),
    requiredBeforeOpen: [
      "case-readiness-report.json must be ready and match this jurisdiction.",
      "plan fixture report must stop at the same first human gate without triggering submission or contacting official URLs.",
      "User must personally verify case facts, reporter data, attachments, and official declarations.",
    ],
    afterManualSubmission: [
      "Record official case number, optional lookup password, and submitted time with update:case-record.",
      "Export case-record-summary.md for local archive review.",
      "Keep CAPTCHA, Email verification, declarations, and final submit manual.",
    ],
  };
}

export async function createPrototypeRun({
  plan,
  allowNetwork = false,
  readinessReport = null,
  planFixtureReport = null,
}) {
  const playwrightAvailable = packageAvailable("playwright");
  const selectorValidation = validateSelectorManifest(plan.jurisdiction);
  const readinessGate = summarizeReadinessReport({ plan, readinessReport });
  const planFixtureGate = summarizePlanFixtureReport({ plan, planFixtureReport });
  const missingData = [
    ...(plan.missingCaseFields || []),
    ...(plan.missingReporterFields || []),
    ...(plan.missingAttachmentNames || []).map((name) => `attachments.${name}`),
  ];

  const result = {
    generatedAt: new Date().toISOString(),
    jurisdiction: plan.jurisdiction,
    officialUrl: plan.officialUrl,
    status: "blocked_by_missing_data",
    allowNetwork,
    playwrightAvailable,
    externalSideEffects: false,
    finalSubmit: false,
    captchaBypass: false,
    emailBypass: false,
    selectorValidation,
    readinessGate,
    planFixtureGate,
    guardedHandoff: createGuardedHandoff({ plan, readinessGate, planFixtureGate }),
    readyStepsBeforeFirstHumanStop: readyStepsBeforeHumanStop(plan),
    firstHumanStop: firstHumanStop(plan),
    manualStopIds: manualStopIds(plan),
    blockedSteps: blockedSteps(plan),
    missing: missingData,
    notes: [],
  };

  if (missingData.length > 0 || plan.status === "blocked_by_missing_data") {
    result.notes.push("Prototype refused to open the official site because required data is missing.");
    return result;
  }

  if (!allowNetwork) {
    result.status = "network_not_allowed";
    result.notes.push("Prototype guard passed, but --allow-network was not provided.");
    result.notes.push("No browser was launched and no official website was contacted.");
    return result;
  }

  if (readinessGate.status !== "ok") {
    result.status = "blocked_by_readiness_report";
    result.notes.push("Prototype refused to open the official site because the case-readiness report is missing or not ready.");
    result.notes.push("Run review:case with a fresh read-only official preflight, then pass --readiness-report.");
    return result;
  }

  if (planFixtureGate.status !== "ok") {
    result.status = "blocked_by_plan_fixture_report";
    result.notes.push("Prototype refused to open the official site because the local plan fixture report is missing or does not stop safely.");
    result.notes.push("Run fixture:plan, then pass --plan-fixture-report.");
    return result;
  }

  result.status = "ready_for_guarded_browser";
  result.notes.push("Plan is ready for a guarded Playwright run up to the first human verification stop.");
  result.notes.push("Implementation must stop before Email/CAPTCHA/declarations/final submit.");
  if (!playwrightAvailable) {
    result.status = "playwright_missing";
    result.notes.push("Install Playwright before enabling a live guarded run.");
  }
  return result;
}
