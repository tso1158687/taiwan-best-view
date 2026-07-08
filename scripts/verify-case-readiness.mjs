#!/usr/bin/env node
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createCaseReadinessReport } from "./lib/case-readiness.mjs";

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
  const incompleteReport = await createCaseReadinessReport({ draft, draftPath: "/tmp/draft.json" });
  assert(incompleteReport.status === "needs_missing_data", "Expected incomplete case to need missing data.");
  assert(incompleteReport.missing.case.includes("case.plate"), "Expected missing plate to be reported.");
  assert(incompleteReport.missing.reporter.includes("reporter.name"), "Expected missing reporter profile fields.");
  assert(incompleteReport.reviewItems.some((item) => item.id === "attachments" && item.status === "needs_review"), "Expected sidecar metadata to require review.");
  assert(incompleteReport.stopBefore.includes("final_submit"), "Expected final submit to remain a stop boundary.");
  assert(incompleteReport.canOpenOfficialSiteForHumanReview === false, "Expected incomplete case not to open official site.");

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
  const completeDraft = {
    ...draft,
    plate: "3999-YG",
    district: "新莊區",
    road: "中正路",
    addressNote: "傳品牛排附近，實際位置仍需人工確認",
    locationReview: {
      source: "exif_gps",
      label: "25.022475, 121.426317",
    },
  };
  const readyReport = await createCaseReadinessReport({
    draft: completeDraft,
    reporterProfile,
    draftPath: "/tmp/draft.json",
  });

  assert(readyReport.status === "ready_for_human_review", "Expected complete local data to be ready for human review.");
  assert(readyReport.canOpenOfficialSiteForHumanReview === true, "Expected ready case to allow human-reviewed official site opening.");
  assert(readyReport.finalSubmitAutomated === false, "Expected final submit to remain manual.");
  assert(readyReport.reporterProfile.status === "ready", "Expected reporter profile summary to be ready.");
  assert(!JSON.stringify(readyReport.reporterProfile).includes("A123456789"), "Reporter summary must not expose identity number.");
  assert(readyReport.reviewItems.some((item) => item.id === "official_human_stops" && item.status === "human_required"), "Expected human stop review item.");

  console.log(JSON.stringify({
    ok: true,
    incompleteStatus: incompleteReport.status,
    readyStatus: readyReport.status,
    canOpenOfficialSiteForHumanReview: readyReport.canOpenOfficialSiteForHumanReview,
    finalSubmitAutomated: readyReport.finalSubmitAutomated,
    verified: ["missing data gate", "reporter privacy summary", "human official-site stop boundary"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
