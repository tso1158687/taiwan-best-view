const NEW_TAIPEI_REQUIRED_CASE_FIELDS = [
  "case.plate",
  "case.occurredAt",
  "case.district",
  "case.road",
  "case.fact",
  "case.description",
];

const NEW_TAIPEI_REQUIRED_REPORTER_FIELDS = [
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

function collectMissing(packet, fields) {
  return fields.filter((field) => hasMissing(packet, field));
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

export function createNewTaipeiAutomationPlan(packet) {
  if (packet.jurisdiction !== "new_taipei") {
    throw new Error(`New Taipei automation plan cannot handle jurisdiction: ${packet.jurisdiction}`);
  }

  const missingCaseFields = collectMissing(packet, NEW_TAIPEI_REQUIRED_CASE_FIELDS);
  const missingReporterFields = collectMissing(packet, NEW_TAIPEI_REQUIRED_REPORTER_FIELDS);
  const missingAttachments = (packet.attachments || []).filter((attachment) => !attachment.acceptedByOfficial);
  const canPrefill = missingCaseFields.length === 0 && missingReporterFields.length === 0 && missingAttachments.length === 0;
  const status = canPrefill ? "ready_until_captcha_email_verification" : "blocked_by_missing_data";

  const steps = [
    step("open_official_site", "開啟新北市交通違規檢舉系統", "goto", {
      status: "ready",
      data: { url: packet.official.url },
    }),
    step("stop_before_disclaimer", "聲明事項前暫停", "stop", {
      status: "manual_required",
      requiresHuman: true,
      stopReason: "聲明事項必須由使用者本人閱讀並確認。",
    }),
    step("prefill_case", "預填違規內容", "fill_case_fields", {
      status: missingCaseFields.length === 0 ? "ready_after_disclaimer" : "blocked",
      data: packet.formMapping.case,
      stopReason: missingCaseFields.length > 0 ? `缺少案件資料：${missingCaseFields.join(", ")}` : "",
    }),
    step("prefill_reporter", "預填檢舉人資料", "fill_reporter_fields", {
      status: missingReporterFields.length === 0 ? "ready_after_disclaimer" : "blocked",
      data: packet.formMapping.reporter,
      stopReason: missingReporterFields.length > 0 ? `缺少檢舉人資料：${missingReporterFields.join(", ")}` : "",
    }),
    step("upload_attachments", "上傳附件", "upload_files", {
      status: missingAttachments.length === 0 ? "ready_after_disclaimer" : "blocked",
      data: packet.attachments.map((attachment) => ({
        name: attachment.submissionName,
        path: attachment.submissionPath,
        size: attachment.size,
      })),
      stopReason: missingAttachments.length > 0 ? "有附件格式不被官方接受。" : "",
    }),
    step("stop_before_captcha", "圖形驗證碼前暫停", "stop", {
      status: "manual_required",
      requiresHuman: true,
      stopReason: "圖形驗證碼必須由使用者本人處理。",
    }),
    step("stop_before_email_verification", "Email 認證前暫停", "stop", {
      status: "manual_required",
      requiresHuman: true,
      stopReason: "Email 認證必須由使用者本人確認。",
    }),
    step("stop_before_final_submit", "最後送出前暫停", "stop", {
      status: "manual_required",
      requiresHuman: true,
      stopReason: "最後送出必須由使用者本人確認。",
    }),
  ];

  return {
    generatedAt: new Date().toISOString(),
    jurisdiction: "new_taipei",
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
