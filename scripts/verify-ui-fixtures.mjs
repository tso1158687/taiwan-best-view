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

async function visibleText(page, selector) {
  return page.locator(selector).innerText();
}

async function main() {
  const fixtureDir = await mkdtemp(join(tmpdir(), "taiwan-best-view-ui-"));
  const recordPath = join(fixtureDir, "case-record.json");
  const historyPath = join(fixtureDir, "case-history.json");
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

  await writeFile(recordPath, `${JSON.stringify(caseRecord, null, 2)}\n`);
  await writeFile(historyPath, `${JSON.stringify(caseHistory, null, 2)}\n`);

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
  } finally {
    await browser.close();
  }

  console.log(JSON.stringify({
    ok: true,
    verified: ["case-record import", "case-history import"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
