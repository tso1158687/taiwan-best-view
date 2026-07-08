function list(values, fallback = "None") {
  const items = (values || []).filter(Boolean);
  if (items.length === 0) return `- ${fallback}`;
  return items.map((value) => `- ${value}`).join("\n");
}

function boolLabel(value) {
  return value ? "yes" : "no";
}

function reviewItemSummary(item) {
  if (!item) return "";

  const lines = [`### ${item.id}`, "", `Status: \`${item.status || "unknown"}\``];

  if (Array.isArray(item.missing)) {
    lines.push("", "Missing:", list(item.missing));
  }
  if (Array.isArray(item.invalid) && item.invalid.length > 0) {
    lines.push("", "Invalid:", list(item.invalid));
  }
  if (Array.isArray(item.issues) && item.issues.length > 0) {
    lines.push("", "Issues:", list(item.issues));
  }
  if (Array.isArray(item.stopBefore)) {
    lines.push("", "Stop before:", list(item.stopBefore));
  }
  if (typeof item.candidateCount === "number") {
    lines.push("", `Candidate count: ${item.candidateCount}`);
  }
  if (Array.isArray(item.confirmedFields) && item.confirmedFields.length > 0) {
    lines.push(
      "",
      "Confirmed fields:",
      list(item.confirmedFields.map((field) => `${field.field}: ${field.value || "-"} (${field.source || "unknown"})`))
    );
  }
  if (item.note) {
    lines.push("", item.note);
  }

  return lines.join("\n");
}

export function formatCaseReadinessMarkdown(report) {
  const reporter = report.reporterProfile || {};
  const missing = report.missing || {};
  const preflight = report.officialPreflight || {};
  const commandHints = report.commandHints || [];

  return [
    "# Case Readiness Checklist",
    "",
    `Generated: ${report.generatedAt || ""}`,
    `Case ID: ${report.caseId || "not set"}`,
    `Jurisdiction: ${report.jurisdiction || "not set"}`,
    `Official URL: ${report.officialUrl || "not set"}`,
    `Status: \`${report.status || "unknown"}\``,
    `Can open official site for human review: ${boolLabel(report.canOpenOfficialSiteForHumanReview)}`,
    `Final submit automated: ${boolLabel(report.finalSubmitAutomated)}`,
    "",
    "## Missing Fields",
    "",
    "Case:",
    list(missing.case),
    "",
    "Reporter:",
    list(missing.reporter),
    "",
    "## Reporter Profile Summary",
    "",
    `Status: \`${reporter.status || "unknown"}\``,
    "",
    "Present fields:",
    list(reporter.presentFields),
    "",
    "Missing fields:",
    list(reporter.missing),
    "",
    "Invalid fields:",
    list(reporter.invalid),
    "",
    "Optional missing fields:",
    list(reporter.optionalMissing),
    "",
    "Reporter values are intentionally omitted from this checklist.",
    "",
    "## Human Stop Points",
    "",
    list(report.stopBefore),
    "",
    "## Official Preflight",
    "",
    `Status: \`${preflight.status || "not_provided"}\``,
    `Generated: ${preflight.generatedAt || "not provided"}`,
    `Age hours: ${preflight.ageHours ?? "unknown"}`,
    `Preflight status: ${preflight.preflightStatus || "not provided"}`,
    "",
    "Issues:",
    list(preflight.issues),
    "",
    "## Next Steps",
    "",
    list(report.nextSteps),
    "",
    "## Command Hints",
    "",
    list(commandHints),
    "",
    "## Review Items",
    "",
    (report.reviewItems || []).map(reviewItemSummary).filter(Boolean).join("\n\n"),
    "",
  ].join("\n");
}
