#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { getOfficialSelectorManifest, validateSelectorManifest } from "./lib/official-selector-manifests.mjs";

function usage() {
  console.log("Usage: node scripts/live-official-preflight.mjs <taipei|new_taipei> --allow-network [--json output.json]");
  console.log("");
  console.log("Opens official websites in a guarded read-only Playwright session and verifies visible selectors.");
  console.log("It does not fill data, click verification controls, upload files, or submit forms.");
}

function parseArgs(argv) {
  const result = {
    jurisdiction: argv[2],
    allowNetwork: false,
    output: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    if (argv[index] === "--allow-network") {
      result.allowNetwork = true;
    } else if (argv[index] === "--json") {
      result.output = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

function absoluteUrl(baseUrl, route) {
  return new URL(route, baseUrl).toString();
}

function visibleFieldChecks(manifest) {
  return Object.entries(manifest.fields)
    .filter(([, field]) => field.selector)
    .map(([field, config]) => ({
      field,
      selector: config.selector,
      phase: config.phase || "visible",
    }));
}

async function countSelector(page, selector) {
  try {
    return await page.locator(selector).count();
  } catch {
    return 0;
  }
}

async function runTaipeiPreflight({ browser, manifest }) {
  const page = await browser.newPage();
  const url = absoluteUrl(manifest.officialUrl, manifest.routes.home);
  let navigationError = "";
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch((error) => {
    navigationError = error.message;
  });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const startButton = page.getByText("開始檢舉", { exact: false }).first();
  const startButtonCount = await startButton.count().catch(() => 0);
  if (startButtonCount > 0) {
    await startButton.click({ timeout: 15000 }).catch(() => {});
    await page.locator("#sPub_id").waitFor({ timeout: 20000 }).catch(() => {});
  }

  const checks = [];
  for (const item of visibleFieldChecks(manifest)) {
    const count = await countSelector(page, item.selector);
    checks.push({
      ...item,
      status: count > 0 ? "present" : item.phase === "after_email" ? "deferred_until_email_verification" : "missing",
      count,
    });
  }

  const emailButtonCount = await page.getByText("發送認證信", { exact: false }).count().catch(() => 0);
  const title = await page.title().catch(() => "");
  const currentUrl = page.url();
  await page.close();

  return {
    url,
    currentUrl,
    title,
    navigationError,
    checks,
    humanStopChecks: {
      startReportTriggerText: startButtonCount,
      emailVerificationTriggerText: emailButtonCount,
      finalSubmitNotTouched: true,
    },
  };
}

async function runNewTaipeiPreflight({ browser, manifest }) {
  const disclaimerPage = await browser.newPage();
  const disclaimerUrl = absoluteUrl(manifest.officialUrl, manifest.routes.disclaimer);
  await disclaimerPage.goto(disclaimerUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  const disclaimerSelectorCount = await countSelector(disclaimerPage, manifest.humanStops.disclaimer.selector);
  const nextButtonCount = await countSelector(disclaimerPage, manifest.humanStops.disclaimer.nextButtonSelector);
  const disclaimerTitle = await disclaimerPage.title();
  await disclaimerPage.close();

  const reportPage = await browser.newPage();
  const reportUrl = absoluteUrl(manifest.officialUrl, manifest.routes.newReport);
  await reportPage.goto(reportUrl, { waitUntil: "domcontentloaded", timeout: 45000 });

  const checks = [];
  for (const item of visibleFieldChecks(manifest)) {
    const count = await countSelector(reportPage, item.selector);
    checks.push({
      ...item,
      status: count > 0 ? "present" : "missing",
      count,
    });
  }

  const captchaSelectorCount = await countSelector(reportPage, manifest.humanStops.captcha.selector);
  const emailVerificationSelectorCount = await countSelector(reportPage, manifest.humanStops.emailVerification.selector);
  const reportTitle = await reportPage.title();
  await reportPage.close();

  return {
    disclaimer: {
      url: disclaimerUrl,
      title: disclaimerTitle,
      checkboxCount: disclaimerSelectorCount,
      nextButtonCount,
    },
    report: {
      url: reportUrl,
      title: reportTitle,
      checks,
    },
    humanStopChecks: {
      captchaSelectorCount,
      emailVerificationSelectorCount,
      finalSubmitNotTouched: true,
    },
  };
}

function summarizeChecks(checks) {
  return {
    present: checks.filter((item) => item.status === "present").length,
    deferred: checks.filter((item) => item.status === "deferred_until_email_verification").length,
    missing: checks.filter((item) => item.status === "missing").map((item) => item.field),
  };
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.jurisdiction || options.jurisdiction === "--help" || options.jurisdiction === "-h") {
    usage();
    return;
  }

  if (!options.allowNetwork) {
    throw new Error("Refusing to contact official websites without --allow-network.");
  }

  const manifest = getOfficialSelectorManifest(options.jurisdiction);
  const validation = validateSelectorManifest(options.jurisdiction);
  const browser = await chromium.launch({ headless: true });
  let result;
  try {
    result = options.jurisdiction === "taipei"
      ? await runTaipeiPreflight({ browser, manifest })
      : await runNewTaipeiPreflight({ browser, manifest });
  } finally {
    await browser.close();
  }

  const checks = options.jurisdiction === "taipei" ? result.checks : result.report.checks;
  const summary = summarizeChecks(checks);
  const report = {
    generatedAt: new Date().toISOString(),
    jurisdiction: options.jurisdiction,
    mode: "live_official_read_only_preflight",
    status: summary.missing.length === 0 ? "ok" : "needs_selector_update",
    externalSideEffects: false,
    dataFilled: false,
    fileUploaded: false,
    finalSubmitTriggered: false,
    selectorValidation: validation,
    summary,
    result,
  };
  if (options.jurisdiction === "taipei" && result.navigationError) {
    report.status = "needs_official_recheck";
  }

  if (options.output) {
    const outputPath = resolve(options.output);
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ outputPath, status: report.status, ...summary }, null, 2));
    return;
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
