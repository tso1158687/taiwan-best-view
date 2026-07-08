import { access } from "node:fs/promises";
import { basename } from "node:path";
import { getOfficialSelectorManifest, validateSelectorManifest } from "./official-selector-manifests.mjs";

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldLocator(field) {
  if (field.selector) return field.selector;
  if (field.vueModel) return `[data-vue-model="${field.vueModel}"]`;
  return "";
}

function inputName(fieldKey, field) {
  return field.name || field.namePrefix || field.vueModel || fieldKey;
}

function fieldHtml(fieldKey, field) {
  if (fieldKey === "attachments") {
    if (field.namePrefix) {
      return [1, 2, 3, 4, 5]
        .map((index) => `<label>${htmlEscape(field.label || "附件")} ${index}<input type="file" name="${htmlEscape(`${field.namePrefix}${index}`)}" data-field-key="${htmlEscape(fieldKey)}"></label>`)
        .join("\n");
    }

    const multiple = field.selector?.includes("multiple") ? " multiple" : "";
    return `<label>${htmlEscape(field.label || "附件")}<input type="file" name="attachments" data-field-key="${htmlEscape(fieldKey)}"${multiple}></label>`;
  }

  const idMatch = field.selector?.match(/^#([A-Za-z0-9_.:-]+)$/);
  const name = inputName(fieldKey, field);
  const id = idMatch ? idMatch[1] : name.replace(/[^A-Za-z0-9_-]/g, "_");
  const vueModel = field.vueModel ? ` data-vue-model="${htmlEscape(field.vueModel)}"` : "";

  if (field.selector?.startsWith("input[name='")) {
    return `<label>${htmlEscape(field.label)}<input id="${htmlEscape(id)}" name="${htmlEscape(name)}" data-field-key="${htmlEscape(fieldKey)}"${vueModel}></label>`;
  }

  return `<label>${htmlEscape(field.label)}<input id="${htmlEscape(id)}" name="${htmlEscape(name)}" data-field-key="${htmlEscape(fieldKey)}"${vueModel}></label>`;
}

function stopHtml(jurisdiction, manifest) {
  const stops = [];
  for (const [key, stop] of Object.entries(manifest.humanStops)) {
    if (stop.selector?.startsWith("#")) {
      stops.push(`<label>${htmlEscape(stop.labelIncludes || key)}<input id="${htmlEscape(stop.selector.slice(1))}" data-human-stop="${htmlEscape(key)}"></label>`);
    } else if (stop.selector?.startsWith(".")) {
      stops.push(`<button type="button" class="${htmlEscape(stop.selector.slice(1))}" data-human-stop="${htmlEscape(key)}">${htmlEscape(key)}</button>`);
    }
    if (stop.nextButtonSelector?.startsWith(".")) {
      stops.push(`<button type="button" class="${htmlEscape(stop.nextButtonSelector.slice(1))}" data-human-stop="${htmlEscape(key)}_next">${htmlEscape(key)} next</button>`);
    }
  }

  if (jurisdiction === "new_taipei") {
    stops.push("<input id=\"VaildCode\" data-human-stop=\"captcha\">");
  }

  return stops.join("\n");
}

export function createOfficialFixtureHtml(jurisdiction) {
  const manifest = getOfficialSelectorManifest(jurisdiction);
  const fields = Object.entries(manifest.fields).map(([key, field]) => fieldHtml(key, field)).join("\n");
  const stops = stopHtml(jurisdiction, manifest);
  const finalStop = manifest.humanStops.finalSubmit;
  const finalSelector = finalStop.forbiddenSelector || ".submit_btn";
  const finalClass = finalSelector.startsWith(".") ? finalSelector.slice(1) : "submit_btn";

  return `<!doctype html>
<html lang="zh-Hant-TW">
<head><meta charset="utf-8"><title>${htmlEscape(jurisdiction)} fixture</title></head>
<body>
  <form id="officialForm">
    ${fields}
    ${stops}
    <button type="submit" class="${htmlEscape(finalClass)}">送出</button>
  </form>
  <script>
    window.__events = [];
    document.querySelectorAll("[data-human-stop]").forEach((node) => {
      node.addEventListener("click", () => window.__events.push({ type: "human-stop-click", key: node.dataset.humanStop }));
    });
    document.querySelector("#officialForm").addEventListener("submit", (event) => {
      event.preventDefault();
      window.__events.push({ type: "submit" });
    });
  </script>
</body>
</html>`;
}

function valueFromPacket(fieldKey, packet) {
  const caseMap = packet.formMapping?.case || {};
  const reporterMap = packet.formMapping?.reporter || {};
  const values = {
    "reporter.identityType": reporterMap.identityType || "taiwan",
    "reporter.identityNumber": reporterMap.identityNumber,
    "reporter.name": reporterMap.name,
    "reporter.phone": reporterMap.phone,
    "reporter.phoneExtension": reporterMap.phoneExtension,
    "reporter.address": reporterMap.address,
    "reporter.email": reporterMap.email,
    "case.vehicleType": caseMap.vehicleType,
    "case.plateType": caseMap.plateType,
    "case.platePrefix": caseMap.platePrefix,
    "case.plateSuffix": caseMap.plateSuffix,
    "case.date": caseMap.date,
    "case.time": caseMap.time,
    "case.hour": caseMap.hour,
    "case.minute": caseMap.minute,
    "case.cityScope": caseMap.cityScope || "新北市",
    "case.district": caseMap.district,
    "case.road": caseMap.road || caseMap.street,
    "case.addressNote": caseMap.addressNote,
    "case.fact": caseMap.fact,
    "case.description": caseMap.description,
  };

  return values[fieldKey] ?? "";
}

async function existingAttachmentPaths(packet) {
  const paths = [];
  for (const attachment of packet.attachments || []) {
    if (!attachment.submissionPath) continue;
    try {
      await access(attachment.submissionPath);
      paths.push(attachment.submissionPath);
    } catch {
      // Missing generated files are reported by the caller through uploadedAttachmentCount.
    }
  }
  return paths;
}

function fieldGroup(fieldKey) {
  if (fieldKey.startsWith("reporter.")) return "reporter";
  if (fieldKey.startsWith("case.")) return "case";
  if (fieldKey === "attachments") return "attachments";
  return "other";
}

async function fillFieldGroup({ page, manifest, packet, group }) {
  const filled = [];
  for (const [fieldKey, field] of Object.entries(manifest.fields)) {
    if (fieldGroup(fieldKey) !== group) continue;
    const locator = fieldLocator(field);
    const value = String(valueFromPacket(fieldKey, packet) || "");
    if (!locator || !value) continue;
    await page.locator(locator).first().fill(value);
    filled.push({ field: fieldKey, locator, valueLength: value.length, group });
  }
  return filled;
}

async function uploadAttachments({ page, manifest, packet }) {
  const attachmentPaths = await existingAttachmentPaths(packet);
  if (attachmentPaths.length > 0) {
    const attachmentLocator = page.locator(manifest.fields.attachments.selector);
    const attachmentInputCount = await attachmentLocator.count();
    if (attachmentInputCount > 1) {
      for (let index = 0; index < Math.min(attachmentPaths.length, attachmentInputCount); index += 1) {
        await attachmentLocator.nth(index).setInputFiles(attachmentPaths[index]);
      }
    } else {
      await attachmentLocator.first().setInputFiles(attachmentPaths);
    }
  }

  const uploadedAttachmentNameLists = await page
    .locator(manifest.fields.attachments.selector)
    .evaluateAll((inputs) => inputs.map((input) => Array.from(input.files || []).map((file) => file.name)));
  return uploadedAttachmentNameLists.flat();
}

async function collectHumanStopPresence({ page, manifest }) {
  const humanStopPresence = {};
  for (const [key, stop] of Object.entries(manifest.humanStops)) {
    const selector = stop.selector || stop.forbiddenSelector || stop.nextButtonSelector;
    humanStopPresence[key] = selector ? await page.locator(selector).count() : 0;
  }
  return humanStopPresence;
}

export async function createReviewedPacketForFixture(packet) {
  const reviewed = structuredClone(packet);
  const occurredAtParts = reviewed.caseData?.occurredAtParts || {};
  reviewed.status = "ready_for_human_review";
  reviewed.missing = [];
  reviewed.formMapping.reporter = {
    identityType: "taiwan",
    identityNumber: "A123456789",
    name: "Fixture Tester",
    phone: "0212345678",
    phoneExtension: "",
    address: "臺北市中正區測試路1號",
    email: "fixture@example.test",
  };

  const baseCase = {
    ...reviewed.formMapping.case,
    vehicleType: reviewed.formMapping.case.vehicleType || "汽車",
    plateType: reviewed.formMapping.case.plateType || "普通車",
    platePrefix: reviewed.formMapping.case.platePrefix || "3999",
    plateSuffix: reviewed.formMapping.case.plateSuffix || "YG",
    date: reviewed.formMapping.case.date || occurredAtParts.date || "2026-06-12",
    time: reviewed.formMapping.case.time || occurredAtParts.time || "15:32",
    hour: reviewed.formMapping.case.hour || occurredAtParts.hour || "15",
    minute: reviewed.formMapping.case.minute || occurredAtParts.minute || "32",
    cityScope: reviewed.formMapping.case.cityScope || "新北市",
    district: reviewed.formMapping.case.district || "新莊區",
    road: reviewed.formMapping.case.road || reviewed.formMapping.case.street || "中正路",
    street: reviewed.formMapping.case.street || reviewed.formMapping.case.road || "中正路",
    addressNote: reviewed.formMapping.case.addressNote || "傳品牛排前，GPS 候選 25.022475, 121.426317",
    fact: reviewed.formMapping.case.fact || "違規停車",
    description: reviewed.formMapping.case.description || "車輛停放於違規地點，妨礙通行或影響交通安全。",
  };
  reviewed.formMapping.case = baseCase;

  return reviewed;
}

export async function runFixtureFill({ jurisdiction, packet, outputPath = "" }) {
  const { chromium } = await import("playwright");
  const manifest = getOfficialSelectorManifest(jurisdiction);
  const validation = validateSelectorManifest(jurisdiction);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const html = createOfficialFixtureHtml(jurisdiction);

  await page.setContent(html);

  const reporterFields = await fillFieldGroup({ page, manifest, packet, group: "reporter" });
  const caseFields = await fillFieldGroup({ page, manifest, packet, group: "case" });
  const filled = [...reporterFields, ...caseFields];
  const uploadedAttachmentNames = await uploadAttachments({ page, manifest, packet });
  const humanStopPresence = await collectHumanStopPresence({ page, manifest });

  const events = await page.evaluate(() => window.__events);
  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    jurisdiction,
    mode: "local_fixture_browser",
    status: validation.status === "ok" && uploadedAttachmentNames.length > 0 ? "ok" : "needs_review",
    externalSideEffects: false,
    officialUrlContacted: false,
    finalSubmitTriggered: events.some((event) => event.type === "submit"),
    humanStopTriggered: events.some((event) => event.type === "human-stop-click"),
    selectorValidation: validation,
    filledFieldCount: filled.length,
    filled,
    uploadedAttachmentCount: uploadedAttachmentNames.length,
    uploadedAttachmentNames: uploadedAttachmentNames.map((name) => basename(name)),
    humanStopPresence,
    outputPath,
  };

  if (report.finalSubmitTriggered || report.humanStopTriggered) {
    report.status = "unsafe_event_triggered";
  }

  return report;
}

export async function runPlanFixture({ jurisdiction, packet, plan, outputPath = "" }) {
  const { chromium } = await import("playwright");
  const manifest = getOfficialSelectorManifest(jurisdiction);
  const validation = validateSelectorManifest(jurisdiction);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const html = createOfficialFixtureHtml(jurisdiction);

  await page.setContent(html);

  const executedSteps = [];
  const blockedSteps = [];
  const filled = [];
  let stoppedAtStepId = "";
  let stoppedAtTitle = "";
  let uploadedAttachmentNames = [];

  for (const step of plan.steps || []) {
    if (step.status === "blocked") {
      blockedSteps.push({ id: step.id, reason: step.stopReason });
      break;
    }
    if (step.requiresHuman || step.action === "stop") {
      stoppedAtStepId = step.id;
      stoppedAtTitle = step.title;
      break;
    }

    executedSteps.push({ id: step.id, action: step.action, status: step.status });
    if (step.action === "fill_reporter_fields") {
      const reporterFields = await fillFieldGroup({ page, manifest, packet, group: "reporter" });
      filled.push(...reporterFields);
    } else if (step.action === "fill_case_fields") {
      const caseFields = await fillFieldGroup({ page, manifest, packet, group: "case" });
      filled.push(...caseFields);
    } else if (step.action === "upload_files") {
      uploadedAttachmentNames = await uploadAttachments({ page, manifest, packet });
    }
  }

  const humanStopPresence = await collectHumanStopPresence({ page, manifest });
  const events = await page.evaluate(() => window.__events);
  await browser.close();

  const filledGroups = {
    reporter: filled.filter((item) => item.group === "reporter").length,
    case: filled.filter((item) => item.group === "case").length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    jurisdiction,
    mode: "local_fixture_plan_runner",
    status: stoppedAtStepId ? "stopped_at_human_gate" : "completed_without_human_gate",
    externalSideEffects: false,
    officialUrlContacted: false,
    finalSubmitTriggered: events.some((event) => event.type === "submit"),
    humanStopTriggered: events.some((event) => event.type === "human-stop-click"),
    selectorValidation: validation,
    executedSteps,
    stoppedAtStepId,
    stoppedAtTitle,
    blockedSteps,
    filledFieldCount: filled.length,
    filledGroups,
    filled,
    uploadedAttachmentCount: uploadedAttachmentNames.length,
    uploadedAttachmentNames: uploadedAttachmentNames.map((name) => basename(name)),
    humanStopPresence,
    outputPath,
  };

  if (validation.status !== "ok") {
    report.status = "needs_selector_update";
  }
  if (blockedSteps.length > 0) {
    report.status = "blocked_step";
  }
  if (report.finalSubmitTriggered || report.humanStopTriggered) {
    report.status = "unsafe_event_triggered";
  }

  return report;
}
