const TAIPEI_REQUIRED_CASE_FIELDS = [
  "case.plate",
  "case.occurredAt",
  "case.district",
  "case.road",
  "case.fact",
  "case.description",
];

const TAIPEI_REQUIRED_REPORTER_FIELDS = [
  "reporter.identityType",
  "reporter.identityNumber",
  "reporter.name",
  "reporter.phone",
  "reporter.address",
  "reporter.email",
];

function hasMissing(packet, field) {
  return (packet.missing || []).includes(field);
}

function step(id, title, action, options = {}) {
  return {
    id,
    title,
    action,
    status: options.status || "pending",
    data: options.data || null,
    stopReason: options.stopReason || "",
    requiresHuman: Boolean(options.requiresHuman),
  };
}

function collectMissing(packet, fields) {
  return fields.filter((field) => hasMissing(packet, field));
}

export function createTaipeiAutomationPlan(packet) {
  if (packet.jurisdiction !== "taipei") {
    throw new Error(`Taipei automation plan cannot handle jurisdiction: ${packet.jurisdiction}`);
  }

  const missingCaseFields = collectMissing(packet, TAIPEI_REQUIRED_CASE_FIELDS);
  const missingReporterFields = collectMissing(packet, TAIPEI_REQUIRED_REPORTER_FIELDS);
  const missingAttachments = (packet.attachments || []).filter((attachment) => !attachment.acceptedByOfficial);
  const canStartReporterPrefill = missingReporterFields.length === 0;
  const canStartCasePrefill = missingCaseFields.length === 0 && missingAttachments.length === 0;
  const status = canStartReporterPrefill && canStartCasePrefill
    ? "ready_until_email_verification"
    : "blocked_by_missing_data";

  const steps = [
    step("open_official_site", "開啟臺北市交通違規檢舉專區", "goto", {
      status: "ready",
      data: {
        url: packet.official.url,
      },
    }),
    step("start_report", "進入開始檢舉流程", "click_start_report", {
      status: "ready",
    }),
    step("prefill_reporter", "預填檢舉人資料", "fill_reporter_fields", {
      status: canStartReporterPrefill ? "ready" : "blocked",
      data: packet.formMapping.reporter,
      stopReason: missingReporterFields.length > 0 ? `缺少檢舉人資料：${missingReporterFields.join(", ")}` : "",
    }),
    step("stop_before_email_verification", "發送 Email 認證前暫停", "stop", {
      status: "manual_required",
      requiresHuman: true,
      stopReason: "Email 認證必須由使用者本人確認。",
    }),
    step("prefill_case", "Email 驗證後預填檢舉內容", "fill_case_fields", {
      status: canStartCasePrefill ? "ready_after_email" : "blocked",
      data: packet.formMapping.case,
      stopReason: missingCaseFields.length > 0 ? `缺少案件資料：${missingCaseFields.join(", ")}` : "",
    }),
    step("upload_attachments", "上傳附件", "upload_files", {
      status: missingAttachments.length === 0 ? "ready_after_email" : "blocked",
      data: packet.attachments.map((attachment) => ({
        name: attachment.submissionName,
        path: attachment.submissionPath,
        size: attachment.size,
      })),
      stopReason: missingAttachments.length > 0 ? "有附件格式不被官方接受。" : "",
    }),
    step("stop_before_declarations", "個資與真實性聲明前暫停", "stop", {
      status: "manual_required",
      requiresHuman: true,
      stopReason: "個資蒐集、隱私權政策、資料真實聲明必須由使用者本人確認。",
    }),
    step("review_pre_submit_summary", "送出前人工檢查摘要", "review_pre_submit_summary", {
      status: "manual_required",
      requiresHuman: true,
      data: packet.preSubmitReview || null,
      stopReason: "送出前請使用者本人逐項確認案件摘要、附件與官方停止點。",
    }),
    step("stop_before_final_submit", "最後送出前暫停", "stop", {
      status: "manual_required",
      requiresHuman: true,
      stopReason: "最後送出必須由使用者本人確認。",
    }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    jurisdiction: "taipei",
    officialUrl: packet.official.url,
    status,
    missingCaseFields,
    missingReporterFields,
    missingAttachmentNames: missingAttachments.map((attachment) => attachment.submissionName),
    safety: {
      dryRunOnly: true,
      externalSideEffects: false,
      captchaBypass: false,
      finalSubmit: false,
    },
    steps,
  };
}
