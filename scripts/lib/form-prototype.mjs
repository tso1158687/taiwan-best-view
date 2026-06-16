import { readFile } from "node:fs/promises";
import { commandExists } from "./system.mjs";

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

export async function createPrototypeRun({ plan, allowNetwork = false }) {
  const playwrightAvailable = await commandExists("npx");
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

  result.status = "ready_for_guarded_browser";
  result.notes.push("Plan is ready for a guarded Playwright run up to the first human verification stop.");
  result.notes.push("Implementation must stop before Email/CAPTCHA/declarations/final submit.");
  result.notes.push("Playwright is optional in this repository; install it before enabling a live guarded run.");
  return result;
}
