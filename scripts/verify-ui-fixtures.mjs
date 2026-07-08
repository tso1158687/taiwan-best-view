#!/usr/bin/env node
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function importJson(page, path) {
  await page.locator("#importInput").setInputFiles(path);
  await page.waitForFunction(() => {
    const panel = document.querySelector("#caseRecordPanel");
    return panel && panel.hidden === false;
  });
}

async function importReadinessJson(page, path) {
  await page.locator("#importInput").setInputFiles(path);
  await page.waitForFunction(() => {
    const panel = document.querySelector("#readinessPanel");
    return panel && panel.hidden === false;
  });
}

async function importDraftJson(page, path, expectedText = "locationAssistance") {
  await page.locator("#importInput").setInputFiles(path);
  await page.waitForFunction((text) => {
    const panel = document.querySelector("#locationPanel");
    const preview = document.querySelector("#jsonPreview");
    return panel && panel.hidden === false && preview?.textContent.includes(text);
  }, expectedText);
}

async function visibleText(page, selector) {
  return page.locator(selector).innerText();
}

async function main() {
  const fixtureDir = await mkdtemp(join(tmpdir(), "taiwan-best-view-ui-"));
  const recordPath = join(fixtureDir, "case-record.json");
  const historyPath = join(fixtureDir, "case-history.json");
  const readinessPath = join(fixtureDir, "case-readiness-report.json");
  const draftPath = join(fixtureDir, "draft-with-location.json");
  const confirmedLocationDraftPath = join(fixtureDir, "draft-with-confirmed-location.json");
  const caseRecord = {
    schemaVersion: 1,
    caseId: "case-ui-fixture",
    jurisdiction: "taipei",
    localStatus: "submitted",
    submissionStatus: "submitted_by_user",
    automationStatus: "blocked_by_missing_data",
    official: {
      url: "https://prsweb.tcpd.gov.tw/",
      caseNumber: "TP-FIXTURE-0001",
      lookupPassword: "fixture-only",
      submittedAt: "2026-06-16T12:00:00+08:00",
      correctionStatus: "none",
    },
    requiredHumanStops: ["stop_before_final_submit"],
    missing: [],
    attachmentSummary: [
      {
        originalName: "IMG_2630.HEIC",
        submissionName: "IMG_2630.png",
        conversionStatus: "converted",
        exifStatus: "sidecar",
        gpsStatus: "missing",
        size: 1000000,
      },
    ],
  };
  const caseHistory = {
    count: 2,
    cases: [
      {
        caseId: "case-ui-fixture",
        caseDirectory: "cases/case-ui-fixture",
        jurisdiction: "taipei",
        localStatus: "submitted",
        submissionStatus: "submitted_by_user",
        automationStatus: "blocked_by_missing_data",
        officialCaseNumber: "TP-FIXTURE-0001",
        submittedAt: "2026-06-16T12:00:00+08:00",
        correctionStatus: "none",
        attachmentCount: 2,
        missingCount: 0,
        requiredHumanStopCount: 1,
      },
      {
        caseId: "case-ui-draft",
        caseDirectory: "cases/case-ui-draft",
        jurisdiction: "new_taipei",
        localStatus: "draft",
        submissionStatus: "needs_missing_data",
        automationStatus: "blocked_by_missing_data",
        officialCaseNumber: "",
        submittedAt: "",
        correctionStatus: "",
        attachmentCount: 1,
        missingCount: 3,
        requiredHumanStopCount: 4,
      },
    ],
  };
  const readinessReport = {
    generatedAt: "2026-07-09T00:00:00.000Z",
    draftPath: "/tmp/draft.json",
    caseId: "case-readiness-ui-fixture",
    jurisdiction: "taipei",
    officialUrl: "https://prsweb.tcpd.gov.tw/",
    status: "needs_missing_data",
    canOpenOfficialSiteForHumanReview: false,
    finalSubmitAutomated: false,
    missing: {
      all: ["case.plate", "reporter.name"],
      case: ["case.plate"],
      reporter: ["reporter.name"],
    },
    reporterProfile: {
      status: "needs_missing_data",
      missing: ["reporter.name"],
      invalid: [],
      optionalMissing: [],
      presentFields: [],
    },
    reviewItems: [
      {
        id: "case_required_fields",
        status: "needs_missing_data",
        missing: ["case.plate"],
      },
      {
        id: "official_human_stops",
        status: "human_required",
        stopBefore: ["final_submit"],
      },
    ],
    manualBoundaries: ["Automation must stop before any final submit action."],
    stopBefore: ["final_submit"],
    nextSteps: [
      "Fill or confirm missing fields: case.plate, reporter.name",
      "Complete CAPTCHA, Email verification, declarations, pre-submit review, and final submit manually.",
    ],
  };
  const draftWithLocation = {
    jurisdiction: "taipei",
    violationType: "illegal_parking",
    plate: "",
    occurredAt: "2026-06-12T15:32:11+08:00",
    district: "",
    road: "",
    addressNote: "",
    fact: "違規停車",
    description: "車輛停放於違規地點，妨礙通行或影響交通安全。",
    files: [],
    originalFiles: [],
    attachments: [],
    locationAssistance: {
      status: "needs_review",
      missingGpsAttachments: ["IMG_2630.HEIC"],
      candidates: [
        {
          source: "exif_gps",
          confidence: "needs_review",
          label: "25.022475, 121.426317",
          latitude: 25.022475,
          longitude: 121.426317,
          evidenceFiles: ["IMG_2631.HEIC"],
          addressLabel: "新北市新莊區中正路",
          reverseGeocode: {
            status: "ok",
            subLocality: "新莊區",
            thoroughfare: "中正路",
          },
          maps: {
            apple: "https://maps.apple.com/?ll=25.022475,121.426317",
            google: "https://maps.google.com/?q=25.022475,121.426317",
          },
          note: "GPS only; user must verify.",
        },
      ],
    },
    photoAnalysis: null,
    fieldSuggestions: { status: "empty", plate: [], district: [], road: [], addressNote: [] },
    status: "draft",
  };
  const draftWithConfirmedLocation = {
    ...draftWithLocation,
    locationAssistance: {
      status: "needs_review",
      missingGpsAttachments: [],
      confirmedLocationCandidateCount: 1,
      candidates: [
        {
          source: "confirmed_location",
          confidence: "needs_review",
          label: "新莊區中正路傳品牛排前人行道",
          latitude: 25.022475,
          longitude: 121.426317,
          district: "新莊區",
          road: "中正路",
          addressNote: "傳品牛排前人行道",
          evidenceFiles: ["IMG_2631.HEIC"],
          addressLabel: "新莊區中正路傳品牛排前人行道",
          reverseGeocode: {
            status: "confirmed_location",
            subLocality: "新莊區",
            thoroughfare: "中正路",
          },
          maps: {
            apple: "https://maps.apple.com/?ll=25.022475,121.426317",
            google: "https://www.google.com/maps/search/?api=1&query=25.022475,121.426317",
          },
          note: "Confirmed frequent location fixture.",
          confirmedLocationId: "fixture-confirmed-location",
          matchReasons: ["within 0m of confirmed location", "matches OCR text: 傳品牛排"],
          useCount: 2,
          lastConfirmedAt: "2026-07-09T00:00:00.000Z",
        },
      ],
    },
  };

  await writeFile(recordPath, `${JSON.stringify(caseRecord, null, 2)}\n`);
  await writeFile(historyPath, `${JSON.stringify(caseHistory, null, 2)}\n`);
  await writeFile(readinessPath, `${JSON.stringify(readinessReport, null, 2)}\n`);
  await writeFile(draftPath, `${JSON.stringify(draftWithLocation, null, 2)}\n`);
  await writeFile(confirmedLocationDraftPath, `${JSON.stringify(draftWithConfirmedLocation, null, 2)}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(pathToFileURL(resolve("index.html")).href);
    await importJson(page, recordPath);
    const recordText = await visibleText(page, "#caseRecordPanel");
    assert(recordText.includes("TP-FIXTURE-0001"), "Expected single case record official case number to render.");
    assert(recordText.includes("使用者已手動送件"), "Expected submitted status label to render.");

    await importJson(page, historyPath);
    const historyText = await visibleText(page, "#caseRecordPanel");
    assert(historyText.includes("2 筆案件"), "Expected case history count to render.");
    assert(historyText.includes("case-ui-draft"), "Expected second history item to render.");

    await importReadinessJson(page, readinessPath);
    const readinessText = await visibleText(page, "#readinessPanel");
    assert(readinessText.includes("case-readiness-ui-fixture"), "Expected readiness report case id to render.");
    assert(readinessText.includes("需補資料"), "Expected readiness status to render.");
    assert(readinessText.includes("case.plate"), "Expected readiness missing case field to render.");
    assert(readinessText.includes("final_submit"), "Expected readiness human stop to render.");

    await importDraftJson(page, draftPath, "25.022475");
    await page.getByRole("button", { name: "採用候選" }).click();
    const draft = await page.evaluate(() => window.taiwanBestView.currentDraft());
    assert(draft.district === "新莊區", "Expected selected location candidate to fill district.");
    assert(draft.road === "中正路", "Expected selected location candidate to fill road.");
    assert(draft.addressNote.includes("GPS 反查 新北市新莊區中正路"), "Expected selected location candidate to fill address note.");
    assert(draft.locationReview?.status === "confirmed_by_user", "Expected selected location candidate to create locationReview.");
    assert(draft.locationReview?.candidateLabel === "25.022475, 121.426317", "Expected selected location candidate label to be recorded.");

    await importDraftJson(page, confirmedLocationDraftPath, "fixture-confirmed-location");
    await page.getByRole("button", { name: "採用候選" }).click();
    const confirmedDraft = await page.evaluate(() => window.taiwanBestView.currentDraft());
    assert(confirmedDraft.district === "新莊區", "Expected confirmed location candidate to fill district.");
    assert(confirmedDraft.road === "中正路", "Expected confirmed location candidate to fill road.");
    assert(confirmedDraft.addressNote.includes("傳品牛排前人行道"), "Expected confirmed location candidate to fill address note.");
    assert(confirmedDraft.locationReview?.confirmedLocationId === "fixture-confirmed-location", "Expected confirmed location id to be recorded.");
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({
    ok: true,
    verified: ["case-record import", "case-history import", "case-readiness import", "location candidate confirmation", "confirmed location candidate confirmation"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
