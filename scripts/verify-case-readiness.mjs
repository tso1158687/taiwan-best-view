#!/usr/bin/env node
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCaseReadinessReport } from "./lib/case-readiness.mjs";
import { formatCaseReadinessMarkdown } from "./lib/case-readiness-markdown.mjs";
import { decryptReporterProfile, encryptReporterProfile, readReporterProfile } from "./lib/reporter-profile.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fixtureDraft() {
  const workspace = await mkdtemp(join(tmpdir(), "taiwan-best-view-readiness-"));
  const attachmentPath = join(workspace, "IMG_0001.png");
  await writeFile(attachmentPath, "fixture image bytes");

  return {
    caseId: "case-readiness-fixture",
    jurisdiction: "taipei",
    violationType: "illegal_parking",
    plate: "",
    occurredAt: "2026-06-12T15:32:11+08:00",
    district: "",
    road: "",
    addressNote: "",
    fact: "違規停車",
    description: "車輛停放於違規地點，妨礙通行或影響交通安全。",
    attachments: [
      {
        originalName: "IMG_0001.HEIC",
        originalPath: attachmentPath,
        submissionName: "IMG_0001.png",
        submissionPath: attachmentPath,
        originalExtension: "heic",
        submissionExtension: "png",
        needsConversion: true,
        conversionStatus: "converted",
        exifStatus: "sidecar",
        gpsStatus: "present",
        acceptedByOfficial: true,
        metadataEmbeddingStatus: "sidecar_only",
      },
    ],
    locationAssistance: {
      status: "needs_review",
      candidates: [
        {
          source: "exif_gps",
          label: "25.022475, 121.426317",
          latitude: 25.022475,
          longitude: 121.426317,
        },
      ],
      missingGpsAttachments: [],
    },
    photoAnalysis: {
      status: "ok",
      engine: "fixture",
      plateCandidates: [
        {
          text: "3999-YG",
          confidence: 0.92,
          pattern: "four_digits_two_letters",
          requiresReview: true,
        },
      ],
      locationTextCandidates: [{ text: "傳品牛排", confidence: 0.7 }],
    },
    fieldSuggestions: {
      status: "needs_review",
      plate: [{ value: "3999-YG" }],
      addressNote: [{ value: "傳品牛排" }],
    },
    status: "draft",
  };
}

async function main() {
  const draft = await fixtureDraft();
  const now = new Date("2026-07-09T12:00:00.000Z");
  const freshOfficialPreflight = {
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
  const staleOfficialPreflight = {
    ...freshOfficialPreflight,
    generatedAt: "2026-07-07T08:00:00.000Z",
  };

  const incompleteReport = await createCaseReadinessReport({ draft, draftPath: "/tmp/draft.json", now });
  assert(incompleteReport.status === "needs_missing_data", "Expected incomplete case to need missing data.");
  assert(incompleteReport.missing.case.includes("case.plate"), "Expected missing plate to be reported.");
  assert(incompleteReport.missing.reporter.includes("reporter.name"), "Expected missing reporter profile fields.");
  assert(incompleteReport.reviewItems.some((item) => item.id === "attachments" && item.status === "needs_review"), "Expected sidecar metadata to require review.");
  assert(incompleteReport.reviewItems.some((item) => item.id === "occurred_at" && item.status === "older_than_review_window"), "Expected old violation time to be flagged for review.");
  assert(incompleteReport.nextSteps.some((step) => step.includes("timestamp")), "Expected timestamp review next step.");
  assert(incompleteReport.stopBefore.includes("final_submit"), "Expected final submit to remain a stop boundary.");
  assert(incompleteReport.canOpenOfficialSiteForHumanReview === false, "Expected incomplete case not to open official site.");
  assert(incompleteReport.officialPreflight.status === "not_provided", "Expected missing official preflight to be reported.");

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
  const encryptedReporterProfile = await encryptReporterProfile(reporterProfile, "fixture-passphrase");
  const encryptedReporterProfileText = JSON.stringify(encryptedReporterProfile);
  const encryptedReporterProfilePath = join(tmpdir(), `reporter-profile-${Date.now()}.encrypted.json`);
  await writeFile(encryptedReporterProfilePath, `${encryptedReporterProfileText}\n`, { mode: 0o600 });
  const decryptedReporterProfile = await decryptReporterProfile(encryptedReporterProfile, "fixture-passphrase");
  const readEncryptedReporterProfile = await readReporterProfile(encryptedReporterProfilePath, { passphrase: "fixture-passphrase" });
  assert(decryptedReporterProfile.identityNumber === reporterProfile.identityNumber, "Expected encrypted reporter profile to decrypt.");
  assert(readEncryptedReporterProfile.email === reporterProfile.email, "Expected encrypted reporter profile file to read.");
  assert(!encryptedReporterProfileText.includes("A123456789"), "Encrypted reporter profile must not include plaintext identity number.");
  assert(!encryptedReporterProfileText.includes("fixture@example.com"), "Encrypted reporter profile must not include plaintext email.");
  const completeDraft = {
    ...draft,
    plate: "3999-YG",
    district: "新莊區",
    road: "中正路",
    addressNote: "傳品牛排附近，實際位置仍需人工確認",
    fieldReview: {
      plate: {
        status: "confirmed_by_user",
        confirmedAt: "2026-07-09T08:30:00.000Z",
        value: "3999-YG",
        source: "ocr_plate",
        confidence: 0.92,
        evidence: "fixture OCR plate candidate",
        requiresReview: true,
      },
    },
    locationReview: {
      source: "exif_gps",
      label: "25.022475, 121.426317",
    },
  };
  const noPreflightReport = await createCaseReadinessReport({
    draft: completeDraft,
    reporterProfile,
    draftPath: "/tmp/draft.json",
    now,
  });
  const stalePreflightReport = await createCaseReadinessReport({
    draft: completeDraft,
    reporterProfile,
    draftPath: "/tmp/draft.json",
    officialPreflight: staleOfficialPreflight,
    now,
  });
  const readyReport = await createCaseReadinessReport({
    draft: completeDraft,
    reporterProfile,
    draftPath: "/tmp/draft.json",
    officialPreflight: freshOfficialPreflight,
    now,
  });
  const readyMarkdown = formatCaseReadinessMarkdown({
    ...readyReport,
    commandHints: ["npm run prepare:submission -- /tmp/draft.json /tmp/reporter-profile.local.json"],
  });

  assert(noPreflightReport.status === "needs_official_preflight", "Expected complete local data without preflight to need official preflight.");
  assert(noPreflightReport.canOpenOfficialSiteForHumanReview === false, "Expected missing preflight to block official-site opening.");
  assert(stalePreflightReport.status === "needs_official_preflight", "Expected stale preflight to need recheck.");
  assert(stalePreflightReport.officialPreflight.issues.includes("official_preflight.stale"), "Expected stale official preflight issue.");
  assert(readyReport.status === "ready_for_human_review", "Expected complete local data and fresh official preflight to be ready for human review.");
  assert(readyReport.canOpenOfficialSiteForHumanReview === true, "Expected ready case to allow human-reviewed official site opening.");
  assert(readyReport.finalSubmitAutomated === false, "Expected final submit to remain manual.");
  assert(readyReport.reporterProfile.status === "ready", "Expected reporter profile summary to be ready.");
  assert(readyReport.officialPreflight.status === "ok", "Expected fresh official preflight to be ok.");
  assert(readyReport.reviewItems.some((item) => item.id === "occurred_at" && item.status === "older_than_review_window"), "Expected ready report to keep timestamp freshness warning.");
  assert(readyReport.reviewItems.some((item) => item.id === "photo_analysis" && item.status === "candidate_confirmed_by_user"), "Expected confirmed field review to update photo analysis readiness.");
  assert(readyMarkdown.includes("older_than_review_window"), "Expected markdown checklist to include timestamp freshness warning.");
  assert(readyMarkdown.includes("plate: 3999-YG"), "Expected markdown checklist to include confirmed field review.");
  assert(!JSON.stringify(readyReport.reporterProfile).includes("A123456789"), "Reporter summary must not expose identity number.");
  assert(readyReport.reviewItems.some((item) => item.id === "official_human_stops" && item.status === "human_required"), "Expected human stop review item.");
  assert(readyMarkdown.includes("# Case Readiness Checklist"), "Expected markdown checklist title.");
  assert(readyMarkdown.includes("final_submit"), "Expected markdown to include final submit stop point.");
  assert(readyMarkdown.includes("npm run prepare:submission"), "Expected markdown to include command hints.");
  assert(!readyMarkdown.includes("A123456789"), "Markdown checklist must not expose identity number.");
  assert(!readyMarkdown.includes("fixture@example.com"), "Markdown checklist must not expose email value.");

  console.log(JSON.stringify({
    ok: true,
    incompleteStatus: incompleteReport.status,
    readyStatus: readyReport.status,
    noPreflightStatus: noPreflightReport.status,
    stalePreflightStatus: stalePreflightReport.status,
    canOpenOfficialSiteForHumanReview: readyReport.canOpenOfficialSiteForHumanReview,
    finalSubmitAutomated: readyReport.finalSubmitAutomated,
    occurredAtReviewStatus: readyReport.reviewItems.find((item) => item.id === "occurred_at")?.status,
    verified: ["missing data gate", "reporter privacy summary", "encrypted reporter profile", "field review confirmation", "occurred-at freshness warning", "human official-site stop boundary", "official preflight freshness gate", "markdown checklist"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
