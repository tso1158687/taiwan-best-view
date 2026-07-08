#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathExists, run } from "./lib/system.mjs";
import { readSipsMetadata } from "./lib/metadata.mjs";
import { createSubmissionPacket } from "./lib/submission-packet.mjs";
import { createCaseReadinessReport } from "./lib/case-readiness.mjs";
import { createTaipeiAutomationPlan } from "./lib/taipei-automation-plan.mjs";
import { createPrototypeRun } from "./lib/form-prototype.mjs";
import { createNewTaipeiAutomationPlan } from "./lib/new-taipei-automation-plan.mjs";
import { createCaseRecord } from "./lib/case-records.mjs";
import { updateCaseRecord, summarizeCaseRecord } from "./lib/case-records.mjs";
import { validateSelectorManifest } from "./lib/official-selector-manifests.mjs";
import { createReviewedPacketForFixture, runFixtureFill } from "./lib/browser-fixture-runner.mjs";
import { summarizeReporterProfile, validateReporterProfile } from "./lib/reporter-profile.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertFile(path) {
  assert(await pathExists(path), `Missing file: ${path}`);
  const fileStat = await stat(path);
  assert(fileStat.size > 100000, `File is too small to be a rendered submission image: ${path}`);
  const metadata = await readSipsMetadata(path);
  assert(Number(metadata.pixelWidth) > 0, `Missing pixel width: ${path}`);
  assert(Number(metadata.pixelHeight) > 0, `Missing pixel height: ${path}`);
}

async function main() {
  assert(await pathExists("test-files"), "Missing test-files directory.");

  const { stdout } = await run("npm", ["run", "create:case", "--", "test-files", "--jurisdiction", "taipei"]);
  const jsonStart = stdout.indexOf("{");
  assert(jsonStart >= 0, "create:case did not print JSON report.");

  const report = JSON.parse(stdout.slice(jsonStart));
  assert(report.inputCount === 2, `Expected 2 inputs, got ${report.inputCount}.`);
  assert(report.submissionFiles.length === 2, "Expected 2 submission files.");
  assert(report.submissionFiles.every((fileName) => fileName.endsWith(".png")), "Expected QuickLook-rendered PNG submission files.");
  assert(report.occurredAtCandidate === "2026-06-12T15:32:11+08:00", "Unexpected occurred-at candidate.");
  assert(report.locationAssistance.status === "needs_review", "Expected location assistance to need review.");
  assert(report.locationAssistance.candidates.length >= 1, "Expected at least one GPS candidate.");
  assert(["ok", "unavailable"].includes(report.locationAssistance.reverseGeocodeStatus), "Expected reverse geocode to be attempted for GPS candidates.");
  assert(report.locationAssistance.missingGpsAttachments.includes("IMG_2630.HEIC"), "Expected IMG_2630.HEIC to be listed as missing GPS.");
  assert(report.photoAnalysis.status === "ok", "Expected OCR photo analysis to succeed.");
  assert(report.photoAnalysis.plateCandidates.length >= 1, "Expected at least one plate candidate.");
  assert(report.photoAnalysis.plateCandidates.some((candidate) => candidate.text === "3999-YG"), "Expected normalized 3999-YG plate candidate.");
  assert(report.photoAnalysis.plateCandidates.some((candidate) => candidate.pattern === "four_digits_two_letters"), "Expected normalized plate pattern metadata.");
  assert(report.photoAnalysis.plateCandidates.every((candidate) => Array.isArray(candidate.confidenceReasons)), "Expected confidence reasons on plate candidates.");
  assert(report.photoAnalysis.locationTextCandidates.length >= 1, "Expected at least one location text candidate.");
  assert(report.fieldSuggestions.status === "needs_review", "Expected field suggestions to need review.");
  assert(report.fieldSuggestions.plate.length >= 1, "Expected at least one plate field suggestion.");
  assert(report.fieldSuggestions.addressNote.length >= 1, "Expected at least one address note field suggestion.");

  for (const fileName of report.submissionFiles) {
    await assertFile(join(report.caseDirectory, "converted", fileName));
  }

  const converted = report.attachments.filter((attachment) => attachment.conversionStatus === "converted");
  assert(converted.length === 2, "Expected both HEIC files to be converted.");
  assert(converted.every((attachment) => ["sidecar", "partial", "preserved"].includes(attachment.exifStatus)), "Expected EXIF to be preserved or tracked in draft sidecar metadata.");
  assert(converted.every((attachment) => ["sidecar_only", "embedded", "failed_sidecar_fallback"].includes(attachment.metadataEmbeddingStatus)), "Expected metadata embedding status for both converted files.");
  assert(converted.every((attachment) => attachment.renderedWidth > 0 && attachment.renderedHeight > 0), "Expected rendered dimensions for both attachments.");
  assert(report.attachments.some((attachment) => attachment.gpsStatus === "present"), "Expected one attachment with GPS.");
  assert(report.attachments.some((attachment) => attachment.gpsStatus === "missing"), "Expected one attachment missing GPS.");

  const draft = JSON.parse(await readFile(join(report.caseDirectory, "draft.json"), "utf8"));
  const readinessNow = new Date("2026-07-09T12:00:00.000Z");
  const taipeiOfficialPreflight = {
    generatedAt: "2026-07-09T08:00:00.000Z",
    jurisdiction: "taipei",
    mode: "live_official_read_only_preflight",
    status: "ok",
    externalSideEffects: false,
    dataFilled: false,
    fileUploaded: false,
    finalSubmitTriggered: false,
    summary: {
      present: 6,
      deferred: 3,
      missing: [],
    },
  };
  const newTaipeiOfficialPreflight = {
    ...taipeiOfficialPreflight,
    jurisdiction: "new_taipei",
    summary: {
      present: 20,
      deferred: 0,
      missing: [],
    },
  };
  const packet = await createSubmissionPacket({ draft });
  const readinessReport = await createCaseReadinessReport({
    draft,
    draftPath: join(report.caseDirectory, "draft.json"),
    now: readinessNow,
  });
  assert(packet.official.url === "https://prsweb.tcpd.gov.tw/", "Expected Taipei official URL.");
  assert(packet.attachments.length === 2, "Expected packet attachment count.");
  assert(packet.missing.includes("case.plate"), "Expected plate to remain missing until human confirmation.");
  assert(packet.missing.includes("reporter.name"), "Expected reporter data to remain missing.");
  assert(packet.official.stopBefore.includes("final_submit"), "Expected final submit stop boundary.");
  assert(readinessReport.status === "needs_missing_data", "Expected readiness gate to report missing real-case data.");
  assert(readinessReport.canOpenOfficialSiteForHumanReview === false, "Expected readiness gate to block official-site opening until data is complete.");
  assert(readinessReport.stopBefore.includes("final_submit"), "Expected readiness gate to preserve final submit boundary.");
  const reporterProfile = {
    identityType: "national_id",
    identityNumber: "A123456789",
    name: "Fixture Reporter",
    phone: "0912345678",
    phoneExtension: "",
    address: "台北市測試區測試路1號",
    email: "fixture@example.com",
    residencePermitFrontFile: "",
  };
  const reporterSummary = summarizeReporterProfile(reporterProfile);
  assert(reporterSummary.status === "ready", "Expected complete reporter profile fixture to validate.");
  assert(!JSON.stringify(reporterSummary).includes("A123456789"), "Reporter summary must not expose identity number.");
  assert(!JSON.stringify(reporterSummary).includes("fixture@example.com"), "Reporter summary must not expose email value.");
  const invalidReporter = validateReporterProfile({ ...reporterProfile, email: "not-an-email" });
  assert(invalidReporter.invalid.includes("reporter.email"), "Expected invalid reporter email to be reported.");
  const reviewedDraft = {
    ...draft,
    plate: "ABC-1234",
    district: "新莊區",
    road: "中正路",
    addressNote: "傳品牛排附近，實際位置仍需人工確認",
  };
  const readyPacket = await createSubmissionPacket({ draft: reviewedDraft, reporterProfile });
  const noPreflightReadinessReport = await createCaseReadinessReport({
    draft: reviewedDraft,
    reporterProfile,
    draftPath: join(report.caseDirectory, "draft.json"),
    now: readinessNow,
  });
  const readyReadinessReport = await createCaseReadinessReport({
    draft: reviewedDraft,
    reporterProfile,
    draftPath: join(report.caseDirectory, "draft.json"),
    officialPreflight: taipeiOfficialPreflight,
    now: readinessNow,
  });
  assert(readyPacket.status === "ready_for_human_review", "Expected complete reporter profile and reviewed case fields to produce a review-ready packet.");
  assert(readyPacket.missing.length === 0, "Expected no missing fields for review-ready packet.");
  assert(readyPacket.reporterProfile.provided === true, "Expected reporter profile to be marked as provided.");
  assert(noPreflightReadinessReport.status === "needs_official_preflight", "Expected complete local data to require official preflight before official-site opening.");
  assert(noPreflightReadinessReport.canOpenOfficialSiteForHumanReview === false, "Expected missing official preflight to block official-site opening.");
  assert(readyReadinessReport.status === "ready_for_human_review", "Expected readiness gate to allow human-reviewed official-site opening after local data and official preflight are complete.");
  assert(readyReadinessReport.canOpenOfficialSiteForHumanReview === true, "Expected readiness gate to allow official-site opening only for human review.");
  assert(readyReadinessReport.finalSubmitAutomated === false, "Expected readiness gate to keep final submit manual.");
  assert(readyReadinessReport.officialPreflight.status === "ok", "Expected readiness gate to include fresh official preflight.");
  const readyTaipeiPlan = createTaipeiAutomationPlan(readyPacket);
  const taipeiPrototypeWithoutReadiness = await createPrototypeRun({
    plan: readyTaipeiPlan,
    allowNetwork: true,
  });
  const taipeiPrototypeWithStaleReadiness = await createPrototypeRun({
    plan: readyTaipeiPlan,
    allowNetwork: true,
    readinessReport: noPreflightReadinessReport,
  });
  const taipeiPrototypeWithReadiness = await createPrototypeRun({
    plan: readyTaipeiPlan,
    allowNetwork: true,
    readinessReport: readyReadinessReport,
  });
  assert(readyTaipeiPlan.status === "ready_until_email_verification", "Expected reviewed Taipei plan to be ready up to Email verification.");
  assert(taipeiPrototypeWithoutReadiness.status === "blocked_by_readiness_report", "Expected live Taipei prototype to require a readiness report.");
  assert(taipeiPrototypeWithStaleReadiness.status === "blocked_by_readiness_report", "Expected live Taipei prototype to reject missing official preflight readiness.");
  assert(taipeiPrototypeWithReadiness.status === "ready_for_guarded_browser", "Expected live Taipei prototype to pass with fresh readiness report.");
  assert(taipeiPrototypeWithReadiness.readinessGate.status === "ok", "Expected live Taipei prototype readiness gate to pass.");
  const taipeiPlan = createTaipeiAutomationPlan(packet);
  assert(taipeiPlan.status === "blocked_by_missing_data", "Expected Taipei dry run to be blocked by missing data.");
  assert(taipeiPlan.safety.dryRunOnly === true, "Expected Taipei plan to be dry-run only.");
  assert(taipeiPlan.safety.finalSubmit === false, "Expected Taipei plan to disable final submit.");
  assert(taipeiPlan.steps.some((item) => item.id === "stop_before_email_verification" && item.requiresHuman), "Expected email verification stop.");
  const taipeiPrototype = await createPrototypeRun({ plan: taipeiPlan, allowNetwork: false });
  assert(taipeiPrototype.status === "blocked_by_missing_data", "Expected Taipei prototype to refuse missing data.");
  assert(taipeiPrototype.externalSideEffects === false, "Expected Taipei prototype to avoid external side effects.");
  assert(taipeiPrototype.finalSubmit === false, "Expected Taipei prototype to disable final submit.");
  assert(taipeiPrototype.selectorValidation.status === "ok", "Expected Taipei selector manifest to validate.");
  assert(taipeiPrototype.selectorValidation.finalSubmitBlocked === true, "Expected Taipei selector manifest to block final submit.");
  const taipeiFixtureFill = await runFixtureFill({
    jurisdiction: "taipei",
    packet: await createReviewedPacketForFixture(packet),
  });
  assert(taipeiFixtureFill.status === "ok", "Expected Taipei local browser fixture fill to pass.");
  assert(taipeiFixtureFill.uploadedAttachmentCount === 2, "Expected Taipei fixture fill to upload two attachments.");
  assert(taipeiFixtureFill.finalSubmitTriggered === false, "Expected Taipei fixture fill not to submit.");
  assert(taipeiFixtureFill.humanStopTriggered === false, "Expected Taipei fixture fill not to trigger human stops.");

  const newTaipeiDraft = { ...draft, jurisdiction: "new_taipei" };
  const newTaipeiPacket = await createSubmissionPacket({ draft: newTaipeiDraft });
  assert(newTaipeiPacket.official.url === "https://tvrs.ntpd.gov.tw/", "Expected New Taipei official URL.");
  const newTaipeiPlan = createNewTaipeiAutomationPlan(newTaipeiPacket);
  const newTaipeiSelectors = validateSelectorManifest("new_taipei");
  const newTaipeiPrototype = await createPrototypeRun({ plan: newTaipeiPlan, allowNetwork: false });
  assert(newTaipeiPlan.status === "blocked_by_missing_data", "Expected New Taipei dry run to be blocked by missing data.");
  assert(newTaipeiPlan.steps.some((item) => item.id === "stop_before_disclaimer" && item.requiresHuman), "Expected New Taipei disclaimer stop.");
  assert(newTaipeiPlan.steps.some((item) => item.id === "stop_before_captcha" && item.requiresHuman), "Expected New Taipei CAPTCHA stop.");
  assert(newTaipeiSelectors.status === "ok", "Expected New Taipei selector manifest to validate.");
  assert(newTaipeiSelectors.finalSubmitBlocked === true, "Expected New Taipei selector manifest to block final submit.");
  assert(newTaipeiPrototype.status === "blocked_by_missing_data", "Expected New Taipei prototype to refuse missing data.");
  assert(newTaipeiPrototype.captchaBypass === false, "Expected New Taipei prototype to disable CAPTCHA bypass.");
  const reviewedNewTaipeiDraft = { ...reviewedDraft, jurisdiction: "new_taipei" };
  const readyNewTaipeiPacket = await createSubmissionPacket({
    draft: reviewedNewTaipeiDraft,
    reporterProfile,
  });
  const readyNewTaipeiReadinessReport = await createCaseReadinessReport({
    draft: reviewedNewTaipeiDraft,
    reporterProfile,
    draftPath: join(report.caseDirectory, "draft.json"),
    officialPreflight: newTaipeiOfficialPreflight,
    now: readinessNow,
  });
  const readyNewTaipeiPlan = createNewTaipeiAutomationPlan(readyNewTaipeiPacket);
  const newTaipeiPrototypeWithoutReadiness = await createPrototypeRun({
    plan: readyNewTaipeiPlan,
    allowNetwork: true,
  });
  const newTaipeiPrototypeWithTaipeiReadiness = await createPrototypeRun({
    plan: readyNewTaipeiPlan,
    allowNetwork: true,
    readinessReport: readyReadinessReport,
  });
  const newTaipeiPrototypeWithReadiness = await createPrototypeRun({
    plan: readyNewTaipeiPlan,
    allowNetwork: true,
    readinessReport: readyNewTaipeiReadinessReport,
  });
  assert(readyNewTaipeiPacket.status === "ready_for_human_review", "Expected reviewed New Taipei packet to be ready.");
  assert(readyNewTaipeiReadinessReport.status === "ready_for_human_review", "Expected reviewed New Taipei readiness report to be ready.");
  assert(readyNewTaipeiPlan.status === "ready_until_captcha_email_verification", "Expected reviewed New Taipei plan to be ready up to CAPTCHA/Email verification.");
  assert(newTaipeiPrototypeWithoutReadiness.status === "blocked_by_readiness_report", "Expected live New Taipei prototype to require a readiness report.");
  assert(newTaipeiPrototypeWithTaipeiReadiness.status === "blocked_by_readiness_report", "Expected live New Taipei prototype to reject Taipei readiness report.");
  assert(newTaipeiPrototypeWithTaipeiReadiness.readinessGate.issues.includes("readiness_report.jurisdiction_mismatch"), "Expected cross-jurisdiction readiness report mismatch issue.");
  assert(newTaipeiPrototypeWithTaipeiReadiness.readinessGate.issues.includes("readiness_report.official_url_mismatch"), "Expected cross-official-url readiness report mismatch issue.");
  assert(newTaipeiPrototypeWithReadiness.status === "ready_for_guarded_browser", "Expected live New Taipei prototype to pass with matching readiness report.");
  assert(newTaipeiPrototypeWithReadiness.readinessGate.status === "ok", "Expected live New Taipei prototype readiness gate to pass.");
  const newTaipeiFixtureFill = await runFixtureFill({
    jurisdiction: "new_taipei",
    packet: await createReviewedPacketForFixture(newTaipeiPacket),
  });
  assert(newTaipeiFixtureFill.status === "ok", "Expected New Taipei local browser fixture fill to pass.");
  assert(newTaipeiFixtureFill.uploadedAttachmentCount === 2, "Expected New Taipei fixture fill to upload two attachments.");
  assert(newTaipeiFixtureFill.finalSubmitTriggered === false, "Expected New Taipei fixture fill not to submit.");
  assert(newTaipeiFixtureFill.humanStopTriggered === false, "Expected New Taipei fixture fill not to trigger human stops.");

  const caseRecord = createCaseRecord({ draft, submissionPacket: packet, automationPlan: taipeiPlan });
  assert(caseRecord.submissionStatus === "needs_missing_data", "Expected case record to mirror submission status.");
  assert(caseRecord.automationStatus === "blocked_by_missing_data", "Expected case record to mirror automation status.");
  assert(caseRecord.official.caseNumber === "", "Expected official case number to remain manually filled.");
  assert(caseRecord.requiredHumanStops.includes("stop_before_final_submit"), "Expected case record to keep final submit stop.");
  const submittedRecord = updateCaseRecord(caseRecord, {
    localStatus: "submitted",
    submissionStatus: "submitted_by_user",
    official: {
      caseNumber: "TP-FIXTURE-0001",
      lookupPassword: "fixture-only",
      submittedAt: "2026-06-16T12:00:00+08:00",
      correctionStatus: "none",
    },
  });
  const caseSummary = summarizeCaseRecord(submittedRecord, report.caseDirectory);
  assert(caseSummary.officialCaseNumber === "TP-FIXTURE-0001", "Expected case summary to include official case number.");
  assert(caseSummary.submissionStatus === "submitted_by_user", "Expected case summary to include updated submission status.");
  const uiVerification = await run("npm", ["run", "verify:ui"]);
  assert(uiVerification.stdout.includes("\"ok\": true"), "Expected UI fixture verification to pass.");

  console.log(JSON.stringify({
    ok: true,
    caseDirectory: report.caseDirectory,
    occurredAtCandidate: report.occurredAtCandidate,
    locationCandidates: report.locationAssistance.candidates.length,
    reverseGeocodeStatus: report.locationAssistance.reverseGeocodeStatus,
    reverseGeocodeLabels: report.locationAssistance.candidates
      .map((candidate) => candidate.addressLabel)
      .filter(Boolean),
    missingGpsAttachments: report.locationAssistance.missingGpsAttachments,
    plateCandidates: report.photoAnalysis.plateCandidates.map((candidate) => candidate.text),
    plateCandidatePatterns: report.photoAnalysis.plateCandidates.map((candidate) => candidate.pattern),
    locationTextCandidates: report.photoAnalysis.locationTextCandidates.map((candidate) => candidate.text),
    plateSuggestions: report.fieldSuggestions.plate.map((suggestion) => suggestion.value),
    addressNoteSuggestions: report.fieldSuggestions.addressNote.map((suggestion) => suggestion.value),
    submissionPacketStatus: packet.status,
    submissionPacketMissing: packet.missing,
    caseReadinessStatus: readinessReport.status,
    caseReadinessCanOpenOfficialSite: readinessReport.canOpenOfficialSiteForHumanReview,
    reviewedPacketStatus: readyPacket.status,
    noPreflightCaseReadinessStatus: noPreflightReadinessReport.status,
    reviewedCaseReadinessStatus: readyReadinessReport.status,
    reviewedCaseReadinessCanOpenOfficialSite: readyReadinessReport.canOpenOfficialSiteForHumanReview,
    reviewedCaseReadinessOfficialPreflightStatus: readyReadinessReport.officialPreflight.status,
    taipeiPrototypeWithoutReadinessStatus: taipeiPrototypeWithoutReadiness.status,
    taipeiPrototypeWithReadinessStatus: taipeiPrototypeWithReadiness.status,
    reporterProfileSummaryStatus: reporterSummary.status,
    metadataEmbeddingStatuses: converted.map((attachment) => attachment.metadataEmbeddingStatus),
    taipeiDryRunStatus: taipeiPlan.status,
    taipeiDryRunManualStops: taipeiPlan.steps.filter((item) => item.requiresHuman).length,
    taipeiPrototypeStatus: taipeiPrototype.status,
    taipeiSelectorFieldCount: taipeiPrototype.selectorValidation.fieldCount,
    taipeiFixtureFillStatus: taipeiFixtureFill.status,
    taipeiFixtureFilledFields: taipeiFixtureFill.filledFieldCount,
    taipeiFixtureUploadedAttachments: taipeiFixtureFill.uploadedAttachmentCount,
    newTaipeiDryRunStatus: newTaipeiPlan.status,
    newTaipeiDryRunManualStops: newTaipeiPlan.steps.filter((item) => item.requiresHuman).length,
    newTaipeiPrototypeStatus: newTaipeiPrototype.status,
    newTaipeiPrototypeWithoutReadinessStatus: newTaipeiPrototypeWithoutReadiness.status,
    newTaipeiPrototypeWithTaipeiReadinessStatus: newTaipeiPrototypeWithTaipeiReadiness.status,
    newTaipeiPrototypeWithReadinessStatus: newTaipeiPrototypeWithReadiness.status,
    newTaipeiSelectorFieldCount: newTaipeiSelectors.fieldCount,
    newTaipeiFixtureFillStatus: newTaipeiFixtureFill.status,
    newTaipeiFixtureFilledFields: newTaipeiFixtureFill.filledFieldCount,
    newTaipeiFixtureUploadedAttachments: newTaipeiFixtureFill.uploadedAttachmentCount,
    caseRecordStatus: caseRecord.submissionStatus,
    updatedCaseRecordStatus: submittedRecord.submissionStatus,
    caseSummaryOfficialCaseNumber: caseSummary.officialCaseNumber,
    uiFixtureVerification: "ok",
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
