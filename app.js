const STORAGE_KEY = "taiwanBestViewDraft";
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
const HEIC_EXTENSIONS = new Set(["heic", "heif"]);
const TAIPEI_ALLOWED_EXTENSIONS = new Set([
  "jpeg",
  "jpg",
  "png",
  "bmp",
  "tiff",
  "mov",
  "wmv",
  "avi",
  "mp4",
  "3gp",
  "ts",
]);
const NEW_TAIPEI_ALLOWED_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "gif",
  "png",
  "mp4",
  "flv",
  "mpeg",
  "mkv",
  "mov",
  "avi",
  "wmv",
  "zip",
  "rar",
  "ts",
]);

const form = document.querySelector("#caseForm");
const fileInput = document.querySelector("#fileInput");
const importInput = document.querySelector("#importInput");
const fileList = document.querySelector("#fileList");
const fileSummary = document.querySelector("#fileSummary");
const importedFileSummary = document.querySelector("#importedFileSummary");
const fileItemTemplate = document.querySelector("#fileItemTemplate");
const jsonPreview = document.querySelector("#jsonPreview");
const locationPanel = document.querySelector("#locationPanel");
const locationList = document.querySelector("#locationList");
const locationState = document.querySelector("#locationState");
const photoAnalysisPanel = document.querySelector("#photoAnalysisPanel");
const photoAnalysisList = document.querySelector("#photoAnalysisList");
const photoAnalysisState = document.querySelector("#photoAnalysisState");
const suggestionsPanel = document.querySelector("#suggestionsPanel");
const suggestionsList = document.querySelector("#suggestionsList");
const suggestionsState = document.querySelector("#suggestionsState");
const caseRecordPanel = document.querySelector("#caseRecordPanel");
const caseRecordList = document.querySelector("#caseRecordList");
const caseRecordState = document.querySelector("#caseRecordState");
const saveState = document.querySelector("#saveState");
const validationState = document.querySelector("#validationState");
const downloadButton = document.querySelector("#downloadButton");
const resetButton = document.querySelector("#resetButton");

let selectedFiles = [];
let importedAttachments = [];
let importedLocationAssistance = null;
let importedPhotoAnalysis = null;
let importedFieldSuggestions = null;
let importedLocationReview = null;
let importedCaseRecordView = null;

function toTaiwanIsoString(datetimeLocalValue) {
  if (!datetimeLocalValue) return "";
  return `${datetimeLocalValue}:00+08:00`;
}

function toDatetimeLocalValue(taiwanIsoString) {
  if (!taiwanIsoString) return "";
  return taiwanIsoString.replace(":00+08:00", "");
}

function getFileExtension(fileName) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.at(-1) : "";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function replaceExtension(fileName, extension) {
  const lastDot = fileName.lastIndexOf(".");
  const baseName = lastDot >= 0 ? fileName.slice(0, lastDot) : fileName;
  return `${baseName}.${extension}`;
}

function createAttachmentSummary(file, jurisdiction) {
  const originalExtension = getFileExtension(file.name);
  const needsConversion = HEIC_EXTENSIONS.has(originalExtension);
  const submissionExtension = needsConversion ? "png" : originalExtension;
  const allowedExtensions =
    jurisdiction === "new_taipei"
      ? NEW_TAIPEI_ALLOWED_EXTENSIONS
      : TAIPEI_ALLOWED_EXTENSIONS;

  return {
    originalName: file.name,
    submissionName: needsConversion ? replaceExtension(file.name, "png") : file.name,
    originalExtension,
    submissionExtension,
    size: file.size,
    type: file.type || "unknown",
    needsConversion,
    conversionStatus: needsConversion ? "pending" : "not_required",
    exifStatus: needsConversion ? "pending" : "not_checked",
    acceptedByOfficial: allowedExtensions.has(submissionExtension),
  };
}

function createCaseDraft() {
  const data = new FormData(form);
  const jurisdiction = data.get("jurisdiction");
  const attachments =
    selectedFiles.length > 0
      ? selectedFiles.map((file) => createAttachmentSummary(file, jurisdiction))
      : importedAttachments;

  return {
    jurisdiction,
    violationType: data.get("violationType"),
    plate: String(data.get("plate") || "").trim().toUpperCase(),
    occurredAt: toTaiwanIsoString(data.get("occurredAt")),
    district: String(data.get("district") || "").trim(),
    road: String(data.get("road") || "").trim(),
    addressNote: String(data.get("addressNote") || "").trim(),
    fact: String(data.get("fact") || "").trim(),
    description: String(data.get("description") || "").trim(),
    files: attachments.map((attachment) => attachment.submissionName),
    originalFiles: attachments.map((attachment) => attachment.originalName),
    attachments,
    locationAssistance: selectedFiles.length > 0 ? null : importedLocationAssistance,
    locationReview: selectedFiles.length > 0 ? null : importedLocationReview,
    photoAnalysis: selectedFiles.length > 0 ? null : importedPhotoAnalysis,
    fieldSuggestions: selectedFiles.length > 0 ? null : importedFieldSuggestions,
    status: data.get("status"),
    updatedAt: new Date().toISOString(),
  };
}

function validateDraft(draft) {
  const errors = [];
  const totalBytes =
    selectedFiles.length > 0
      ? selectedFiles.reduce((sum, file) => sum + file.size, 0)
      : draft.attachments.reduce((sum, attachment) => sum + (attachment.size || 0), 0);

  if (!draft.plate) errors.push("請填車號");
  if (!draft.occurredAt) errors.push("請填違規日期時間");
  if (!draft.district) errors.push("請填行政區");
  if (!draft.road) errors.push("請填路段");
  if (!draft.fact) errors.push("請填違規事實");
  if (!draft.description) errors.push("請填違規事實說明");
  if (draft.attachments.length < 1) errors.push("請至少選擇 1 個附件");
  if (draft.attachments.length > MAX_FILES) errors.push("附件最多 5 個檔案");
  if (totalBytes > MAX_TOTAL_BYTES) errors.push("附件總容量不可超過 80MB");

  for (const attachment of draft.attachments) {
    if (attachment.needsConversion && attachment.conversionStatus !== "converted") {
      errors.push(`${attachment.originalName} 需先轉成 PNG 並確認 EXIF`);
      continue;
    }

    if (attachment.conversionStatus === "converted" && attachment.exifStatus === "missing") {
      errors.push(`${attachment.originalName} 已轉檔，但缺少 EXIF`);
      continue;
    }

    if (!attachment.acceptedByOfficial) {
      errors.push(`${attachment.originalName} 不符合目前縣市允許的副檔名`);
    }
  }

  if (draft.occurredAt) {
    const occurredAt = new Date(draft.occurredAt);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (occurredAt > now) errors.push("違規時間不可晚於現在");
    if (occurredAt < sevenDaysAgo) errors.push("違規時間可能已超過 7 日檢舉期限");
  }

  return errors;
}

function renderFiles() {
  fileList.textContent = "";
  importedFileSummary.textContent = "";

  if (selectedFiles.length === 0 && importedAttachments.length === 0) {
    fileSummary.textContent = "尚未選擇附件";
    return;
  }

  if (selectedFiles.length === 0) {
    const totalBytes = importedAttachments.reduce((sum, attachment) => sum + (attachment.size || 0), 0);
    fileSummary.textContent = `${importedAttachments.length} 個匯入附件，總計 ${formatBytes(totalBytes)}`;
    importedFileSummary.textContent = "匯入的附件路徑會保留在 JSON；若要重新選檔，請使用上方附件欄位。";

    for (const attachment of importedAttachments) {
      const item = fileItemTemplate.content.firstElementChild.cloneNode(true);
      item.querySelector(".file-name").textContent = attachment.originalName;
      item.querySelector(".file-meta").textContent = formatBytes(attachment.size || 0);

      const badge = item.querySelector(".file-badge");
      if (attachment.conversionStatus === "converted") {
        badge.textContent = attachment.exifStatus === "partial" ? "已轉檔，EXIF 部分" : "已轉檔";
      } else if (attachment.needsConversion) {
        badge.textContent = "需轉 PNG";
      } else if (attachment.acceptedByOfficial) {
        badge.textContent = "可送件格式";
        badge.classList.add("is-ready");
      } else {
        badge.textContent = "不支援";
      }

      fileList.append(item);
    }
    return;
  }

  const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  fileSummary.textContent = `${selectedFiles.length} 個附件，總計 ${formatBytes(totalBytes)}`;

  for (const file of selectedFiles) {
    const attachment = createAttachmentSummary(file, form.elements.jurisdiction.value);
    const item = fileItemTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector(".file-name").textContent = file.name;
    item.querySelector(".file-meta").textContent = formatBytes(file.size);

    const badge = item.querySelector(".file-badge");
    if (attachment.needsConversion) {
      badge.textContent = "需轉 PNG";
    } else if (attachment.acceptedByOfficial) {
      badge.textContent = "可送件格式";
      badge.classList.add("is-ready");
    } else {
      badge.textContent = "不支援";
    }

    fileList.append(item);
  }
}

function renderPreview() {
  const draft = createCaseDraft();
  const errors = validateDraft(draft);
  jsonPreview.textContent = JSON.stringify(importedCaseRecordView || draft, null, 2);
  renderLocationAssistance(draft.locationAssistance);
  renderPhotoAnalysis(draft.photoAnalysis);
  renderFieldSuggestions(draft.fieldSuggestions);
  renderCaseRecordView(importedCaseRecordView);

  if (importedCaseRecordView) {
    validationState.textContent = "紀錄檢視";
    validationState.className = "status-pill";
    return;
  }

  if (errors.length === 0) {
    validationState.textContent = "可人工確認";
    validationState.className = "status-pill";
  } else {
    validationState.textContent = errors[0];
    validationState.className = errors.some((error) => error.includes("不可") || error.includes("不符合"))
      ? "status-pill error"
      : "status-pill warning";
  }
}

function suggestionLabel(field) {
  if (field === "plate") return "車號";
  if (field === "district") return "行政區";
  if (field === "road") return "路段";
  if (field === "addressNote") return "補充地點";
  return field;
}

function applySuggestion(field, value) {
  const target = form.elements[field];
  if (!target) return;

  if (field === "addressNote" && target.value.trim()) {
    target.value = `${target.value.trim()}；${value}`;
  } else {
    target.value = value;
  }

  handleInputChange();
  saveState.textContent = "已套用建議";
}

function candidateAddressNote(candidate) {
  if (candidate.reverseGeocode?.status === "ok" && candidate.addressLabel) {
    return `GPS 反查 ${candidate.addressLabel}`;
  }
  return `GPS 候選 ${candidate.label}`;
}

function applyLocationCandidate(candidate) {
  const district = candidate.reverseGeocode?.subLocality || "";
  const road = candidate.reverseGeocode?.thoroughfare || "";
  const addressNote = candidateAddressNote(candidate);

  if (district) form.elements.district.value = district;
  if (road) form.elements.road.value = road;
  applySuggestion("addressNote", addressNote);

  importedLocationReview = {
    status: "confirmed_by_user",
    confirmedAt: new Date().toISOString(),
    candidateLabel: candidate.label,
    source: candidate.source,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    evidenceFiles: candidate.evidenceFiles || [],
    addressLabel: candidate.addressLabel || "",
    reverseGeocodeStatus: candidate.reverseGeocode?.status || "unavailable",
    district,
    road,
    addressNote,
    maps: candidate.maps || {},
    note: "User selected this candidate after reviewing map links and photo evidence.",
  };

  handleInputChange();
  saveState.textContent = "已採用地點候選";
}

function renderFieldSuggestions(fieldSuggestions) {
  suggestionsList.textContent = "";

  if (!fieldSuggestions || fieldSuggestions.status === "empty") {
    suggestionsPanel.hidden = true;
    return;
  }

  suggestionsPanel.hidden = false;
  suggestionsState.textContent = "需人工確認";
  suggestionsState.className = "status-pill warning";

  for (const field of ["plate", "district", "road", "addressNote"]) {
    const suggestions = fieldSuggestions[field] || [];
    if (suggestions.length === 0) continue;

    const group = document.createElement("div");
    const title = document.createElement("div");
    const actions = document.createElement("div");

    group.className = "suggestion-group";
    title.className = "suggestion-group-title";
    title.textContent = suggestionLabel(field);
    actions.className = "suggestion-actions";

    for (const suggestion of suggestions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-action";
      button.textContent = `${suggestion.value} (${Math.round((suggestion.confidence || 0) * 100)}%)`;
      button.addEventListener("click", () => applySuggestion(field, suggestion.value));
      actions.append(button);
    }

    group.append(title, actions);
    suggestionsList.append(group);
  }
}

function formatJurisdiction(jurisdiction) {
  if (jurisdiction === "taipei") return "台北市";
  if (jurisdiction === "new_taipei") return "新北市";
  return jurisdiction || "未設定";
}

function formatRecordStatus(status) {
  const labels = {
    draft: "草稿",
    ready_for_review: "待人工確認",
    submitted: "已送件",
    not_prepared: "尚未產生送件包",
    needs_missing_data: "缺少必要資料",
    blocked_by_missing_data: "缺少資料，已停止",
    submitted_by_user: "使用者已手動送件",
    none: "無補正",
  };
  return labels[status] || status || "未設定";
}

function formatDateTime(value) {
  if (!value) return "未填";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("zh-TW", { hour12: false });
}

function isCaseRecord(value) {
  return Boolean(value && value.schemaVersion && value.official && Array.isArray(value.attachmentSummary));
}

function isCaseHistory(value) {
  return Boolean(value && Array.isArray(value.cases));
}

function createDetail(label, value) {
  const item = document.createElement("div");
  const title = document.createElement("span");
  const content = document.createElement("strong");

  item.className = "case-record-detail";
  title.textContent = label;
  content.textContent = value || "未填";
  item.append(title, content);
  return item;
}

function appendCaseRecordCard(record, titleText) {
  const card = document.createElement("article");
  const title = document.createElement("div");
  const details = document.createElement("div");

  card.className = "case-record-card";
  title.className = "case-record-title";
  title.textContent = titleText;
  details.className = "case-record-details";

  details.append(
    createDetail("縣市", formatJurisdiction(record.jurisdiction)),
    createDetail("本機狀態", formatRecordStatus(record.localStatus)),
    createDetail("送件狀態", formatRecordStatus(record.submissionStatus)),
    createDetail("自動化狀態", formatRecordStatus(record.automationStatus)),
    createDetail("官方案號", record.official?.caseNumber || record.officialCaseNumber || ""),
    createDetail("送件時間", formatDateTime(record.official?.submittedAt || record.submittedAt)),
    createDetail("補正狀態", formatRecordStatus(record.official?.correctionStatus || record.correctionStatus)),
    createDetail("附件", `${record.attachmentSummary?.length ?? record.attachmentCount ?? 0} 個`),
    createDetail("缺漏欄位", `${record.missing?.length ?? record.missingCount ?? 0} 個`),
    createDetail("人工停止點", `${record.requiredHumanStops?.length ?? record.requiredHumanStopCount ?? 0} 個`)
  );

  if (record.caseDirectory) {
    details.append(createDetail("本機資料夾", record.caseDirectory));
  }

  card.append(title, details);
  caseRecordList.append(card);
}

function renderCaseRecordView(view) {
  caseRecordList.textContent = "";

  if (!view) {
    caseRecordPanel.hidden = true;
    return;
  }

  caseRecordPanel.hidden = false;

  if (isCaseHistory(view)) {
    const cases = view.cases || [];
    caseRecordState.textContent = `${cases.length} 筆案件`;
    caseRecordState.className = cases.length > 0 ? "status-pill" : "status-pill warning";

    for (const record of cases) {
      const title = record.caseId || record.caseDirectory || "未命名案件";
      appendCaseRecordCard(record, title);
    }
    return;
  }

  caseRecordState.textContent = formatRecordStatus(view.submissionStatus);
  caseRecordState.className =
    view.submissionStatus === "submitted_by_user" || view.localStatus === "submitted"
      ? "status-pill"
      : "status-pill warning";
  appendCaseRecordCard(view, view.caseId || "單筆案件紀錄");
}

function appendTextCandidateItem(titleText, candidates) {
  if (!candidates || candidates.length === 0) return;

  const item = document.createElement("li");
  const title = document.createElement("div");
  const meta = document.createElement("div");

  title.className = "location-title";
  title.textContent = titleText;
  meta.className = "location-meta";
  meta.textContent = candidates
    .map((candidate) => {
      const reasons = Array.isArray(candidate.confidenceReasons) && candidate.confidenceReasons.length > 0
        ? `；${candidate.confidenceReasons.slice(0, 2).join("、")}`
        : "";
      return `${candidate.text} (${Math.round((candidate.confidence || 0) * 100)}%)${reasons}`;
    })
    .join("、");

  item.append(title, meta);
  photoAnalysisList.append(item);
}

function renderPhotoAnalysis(photoAnalysis) {
  photoAnalysisList.textContent = "";

  if (!photoAnalysis) {
    photoAnalysisPanel.hidden = true;
    return;
  }

  photoAnalysisPanel.hidden = false;
  photoAnalysisState.textContent = photoAnalysis.status === "ok" ? "需人工確認" : "無法辨識";
  photoAnalysisState.className = photoAnalysis.status === "ok" ? "status-pill warning" : "status-pill error";

  appendTextCandidateItem("車牌候選", photoAnalysis.plateCandidates);
  appendTextCandidateItem("地點文字線索", photoAnalysis.locationTextCandidates);

  if (photoAnalysisList.children.length === 0) {
    const item = document.createElement("li");
    const title = document.createElement("div");
    const meta = document.createElement("div");

    title.className = "location-title";
    title.textContent = "尚無可用文字線索";
    meta.className = "location-meta";
    meta.textContent = photoAnalysis.reason || "請改用人工確認或補拍更清楚的照片。";

    item.append(title, meta);
    photoAnalysisList.append(item);
  }
}

function renderLocationAssistance(locationAssistance) {
  locationList.textContent = "";

  if (!locationAssistance) {
    locationPanel.hidden = true;
    return;
  }

  const candidates = locationAssistance.candidates || [];
  const missingGpsAttachments = locationAssistance.missingGpsAttachments || [];
  locationPanel.hidden = false;
  locationState.textContent = candidates.length > 0 ? "需人工確認" : "需手動補";
  locationState.className = candidates.length > 0 ? "status-pill warning" : "status-pill error";

  for (const candidate of candidates) {
    const item = document.createElement("li");
    const title = document.createElement("div");
    const meta = document.createElement("div");
    const links = document.createElement("div");
    const actions = document.createElement("div");
    const appleLink = document.createElement("a");
    const googleLink = document.createElement("a");
    const applyButton = document.createElement("button");

    title.className = "location-title";
    title.textContent = candidate.label;
    meta.className = "location-meta";
    meta.textContent = `來源：${candidate.evidenceFiles.join("、")}。GPS 只當初始候選，仍需人工確認路段與方向。`;
    links.className = "location-links";
    appleLink.href = candidate.maps.apple;
    appleLink.target = "_blank";
    appleLink.rel = "noreferrer";
    appleLink.textContent = "Apple Maps";
    googleLink.href = candidate.maps.google;
    googleLink.target = "_blank";
    googleLink.rel = "noreferrer";
    googleLink.textContent = "Google Maps";
    actions.className = "location-actions";
    applyButton.type = "button";
    applyButton.className = "suggestion-action";
    applyButton.textContent = "採用候選";
    applyButton.addEventListener("click", () => applyLocationCandidate(candidate));

    links.append(appleLink, googleLink);
    actions.append(applyButton);
    item.append(title, meta, links, actions);
    locationList.append(item);
  }

  if (importedLocationReview?.status === "confirmed_by_user") {
    const item = document.createElement("li");
    const title = document.createElement("div");
    const meta = document.createElement("div");

    title.className = "location-title";
    title.textContent = "已採用的地點候選";
    meta.className = "location-meta";
    meta.textContent = `${importedLocationReview.addressNote || importedLocationReview.candidateLabel}。仍需送件前人工確認路段、方向與照片證據。`;

    item.append(title, meta);
    locationList.prepend(item);
  }

  if (missingGpsAttachments.length > 0) {
    const item = document.createElement("li");
    const title = document.createElement("div");
    const meta = document.createElement("div");

    title.className = "location-title";
    title.textContent = "缺少 GPS 的照片";
    meta.className = "location-meta";
    meta.textContent = `${missingGpsAttachments.join("、")} 需靠 OCR 或手動補地點。`;

    item.append(title, meta);
    locationList.append(item);
  }
}

function persistDraft() {
  const draft = createCaseDraft();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  saveState.textContent = "已暫存";
  window.setTimeout(() => {
    saveState.textContent = "自動暫存中";
  }, 1200);
}

function handleInputChange() {
  renderFiles();
  renderPreview();
  persistDraft();
}

function restoreDraft() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    renderPreview();
    return;
  }

  try {
    const draft = JSON.parse(saved);
    applyDraftToForm(draft);
    saveState.textContent = "已載入暫存";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    saveState.textContent = "暫存已重置";
  }

  renderPreview();
}

function applyDraftToForm(draft) {
  for (const [key, value] of Object.entries(draft)) {
    const field = form.elements[key];
    if (!field || key === "files") continue;
    field.value = key === "occurredAt" ? toDatetimeLocalValue(value) : value;
  }

  importedAttachments = Array.isArray(draft.attachments) ? draft.attachments : [];
  importedLocationAssistance = draft.locationAssistance || null;
  importedLocationReview = draft.locationReview || null;
  importedPhotoAnalysis = draft.photoAnalysis || null;
  importedFieldSuggestions = draft.fieldSuggestions || null;
  importedCaseRecordView = null;
  selectedFiles = [];
  fileInput.value = "";
  renderFiles();
}

function importCaseRecordView(view) {
  importedCaseRecordView = view;
  selectedFiles = [];
  fileInput.value = "";
  renderFiles();
  renderPreview();
}

async function importDraft(file) {
  if (!file) return;

  try {
    const payload = JSON.parse(await file.text());
    if (isCaseRecord(payload) || isCaseHistory(payload)) {
      importCaseRecordView(payload);
      saveState.textContent = isCaseHistory(payload) ? "已匯入案件歷史" : "已匯入案件紀錄";
    } else {
      applyDraftToForm(payload);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      renderPreview();
      saveState.textContent = "已匯入 JSON";
    }
  } catch {
    validationState.textContent = "JSON 格式無法讀取";
    validationState.className = "status-pill error";
  } finally {
    importInput.value = "";
  }
}

function downloadDraft() {
  const draft = createCaseDraft();
  const errors = validateDraft(draft);
  const blob = new Blob([JSON.stringify(draft, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const plate = draft.plate || "draft";
  const date = draft.occurredAt ? draft.occurredAt.slice(0, 10) : "undated";

  link.href = url;
  link.download = `taiwan-best-view-${plate}-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);

  validationState.textContent = errors.length === 0 ? "已下載 JSON" : "已下載，仍需補資料";
  validationState.className = errors.length === 0 ? "status-pill" : "status-pill warning";
}

function resetDraft() {
  form.reset();
  selectedFiles = [];
  importedAttachments = [];
  importedLocationAssistance = null;
  importedLocationReview = null;
  importedPhotoAnalysis = null;
  importedFieldSuggestions = null;
  importedCaseRecordView = null;
  fileInput.value = "";
  localStorage.removeItem(STORAGE_KEY);
  renderFiles();
  renderPreview();
  saveState.textContent = "已清空";
}

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files || []);
  importedAttachments = [];
  importedLocationAssistance = null;
  importedLocationReview = null;
  importedPhotoAnalysis = null;
  importedFieldSuggestions = null;
  importedCaseRecordView = null;
  renderFiles();
  handleInputChange();
});

importInput.addEventListener("change", () => {
  importDraft(importInput.files?.[0]);
});

form.addEventListener("input", handleInputChange);
form.addEventListener("change", handleInputChange);
downloadButton.addEventListener("click", downloadDraft);
resetButton.addEventListener("click", resetDraft);

window.taiwanBestView = {
  loadDraft(draft) {
    applyDraftToForm(draft);
    renderPreview();
  },
  currentDraft() {
    return createCaseDraft();
  },
};

restoreDraft();
