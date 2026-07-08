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

export async function createPrototypeRun({ plan, allowNetwork = false, readinessReport = null }) {
  const playwrightAvailable = packageAvailable("playwright");
  const selectorValidation = validateSelectorManifest(plan.jurisdiction);
  const readinessGate = summarizeReadinessReport({ plan, readinessReport });
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
    readyStepsBeforeFirstHumanStop: readyStepsBeforeHumanStop(plan),
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

  result.status = "ready_for_guarded_browser";
  result.notes.push("Plan is ready for a guarded Playwright run up to the first human verification stop.");
  result.notes.push("Implementation must stop before Email/CAPTCHA/declarations/final submit.");
  if (!playwrightAvailable) {
    result.status = "playwright_missing";
    result.notes.push("Install Playwright before enabling a live guarded run.");
  }
  return result;
}
