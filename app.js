const STORAGE_KEY = "taiwanBestViewDraft";
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;
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
const fileList = document.querySelector("#fileList");
const fileSummary = document.querySelector("#fileSummary");
const fileItemTemplate = document.querySelector("#fileItemTemplate");
const jsonPreview = document.querySelector("#jsonPreview");
const saveState = document.querySelector("#saveState");
const validationState = document.querySelector("#validationState");
const downloadButton = document.querySelector("#downloadButton");
const resetButton = document.querySelector("#resetButton");

let selectedFiles = [];

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

function createCaseDraft() {
  const data = new FormData(form);
  return {
    jurisdiction: data.get("jurisdiction"),
    violationType: data.get("violationType"),
    plate: String(data.get("plate") || "").trim().toUpperCase(),
    occurredAt: toTaiwanIsoString(data.get("occurredAt")),
    district: String(data.get("district") || "").trim(),
    road: String(data.get("road") || "").trim(),
    addressNote: String(data.get("addressNote") || "").trim(),
    fact: String(data.get("fact") || "").trim(),
    description: String(data.get("description") || "").trim(),
    files: selectedFiles.map((file) => file.name),
    fileSummary: selectedFiles.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type || "unknown",
      extension: getFileExtension(file.name),
    })),
    status: data.get("status"),
    updatedAt: new Date().toISOString(),
  };
}

function validateDraft(draft) {
  const errors = [];
  const allowedExtensions =
    draft.jurisdiction === "new_taipei"
      ? NEW_TAIPEI_ALLOWED_EXTENSIONS
      : TAIPEI_ALLOWED_EXTENSIONS;
  const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);

  if (!draft.plate) errors.push("請填車號");
  if (!draft.occurredAt) errors.push("請填違規日期時間");
  if (!draft.district) errors.push("請填行政區");
  if (!draft.road) errors.push("請填路段");
  if (!draft.fact) errors.push("請填違規事實");
  if (!draft.description) errors.push("請填違規事實說明");
  if (selectedFiles.length < 1) errors.push("請至少選擇 1 個附件");
  if (selectedFiles.length > MAX_FILES) errors.push("附件最多 5 個檔案");
  if (totalBytes > MAX_TOTAL_BYTES) errors.push("附件總容量不可超過 80MB");

  for (const file of selectedFiles) {
    const extension = getFileExtension(file.name);
    if (!allowedExtensions.has(extension)) {
      errors.push(`${file.name} 不符合目前縣市允許的副檔名`);
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

  if (selectedFiles.length === 0) {
    fileSummary.textContent = "尚未選擇附件";
    return;
  }

  const totalBytes = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  fileSummary.textContent = `${selectedFiles.length} 個附件，總計 ${formatBytes(totalBytes)}`;

  for (const file of selectedFiles) {
    const item = fileItemTemplate.content.firstElementChild.cloneNode(true);
    item.querySelector(".file-name").textContent = file.name;
    item.querySelector(".file-meta").textContent = formatBytes(file.size);
    fileList.append(item);
  }
}

function renderPreview() {
  const draft = createCaseDraft();
  const errors = validateDraft(draft);
  jsonPreview.textContent = JSON.stringify(draft, null, 2);

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

function persistDraft() {
  const draft = createCaseDraft();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  saveState.textContent = "已暫存";
  window.setTimeout(() => {
    saveState.textContent = "自動暫存中";
  }, 1200);
}

function handleInputChange() {
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
    for (const [key, value] of Object.entries(draft)) {
      const field = form.elements[key];
      if (!field || key === "files") continue;
      field.value = key === "occurredAt" ? toDatetimeLocalValue(value) : value;
    }
    saveState.textContent = "已載入暫存";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    saveState.textContent = "暫存已重置";
  }

  renderPreview();
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
  fileInput.value = "";
  localStorage.removeItem(STORAGE_KEY);
  renderFiles();
  renderPreview();
  saveState.textContent = "已清空";
}

fileInput.addEventListener("change", () => {
  selectedFiles = Array.from(fileInput.files || []);
  renderFiles();
  handleInputChange();
});

form.addEventListener("input", handleInputChange);
form.addEventListener("change", handleInputChange);
downloadButton.addEventListener("click", downloadDraft);
resetButton.addEventListener("click", resetDraft);

restoreDraft();
