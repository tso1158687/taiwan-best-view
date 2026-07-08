function attachmentRecord(attachment) {
  return {
    originalName: attachment.originalName,
    submissionName: attachment.submissionName,
    conversionStatus: attachment.conversionStatus,
    exifStatus: attachment.exifStatus,
    gpsStatus: attachment.gpsStatus,
    size: attachment.size,
  };
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function createEmptyCorrectionRecord(status = "") {
  return {
    status,
    receivedAt: "",
    dueAt: "",
    items: [],
    note: "",
  };
}

export function summarizeCorrection(record) {
  const official = record.official || {};
  const correction = official.correction || {};
  const status = correction.status || official.correctionStatus || "";

  return {
    status,
    receivedAt: correction.receivedAt || "",
    dueAt: correction.dueAt || "",
    items: Array.isArray(correction.items) ? correction.items : [],
    note: correction.note || "",
  };
}

export function createCaseRecord({ draft, submissionPacket = null, automationPlan = null }) {
  return {
    schemaVersion: 1,
    caseId: draft.caseId || "",
    createdAt: draft.createdAt || "",
    updatedAt: new Date().toISOString(),
    jurisdiction: draft.jurisdiction,
    violationType: draft.violationType,
    localStatus: draft.status || "draft",
    submissionStatus: submissionPacket?.status || "not_prepared",
    automationStatus: automationPlan?.status || "not_planned",
    official: {
      url: submissionPacket?.official?.url || "",
      caseNumber: "",
      lookupPassword: "",
      submittedAt: "",
      correctionStatus: "",
      correction: createEmptyCorrectionRecord(),
    },
    requiredHumanStops: automationPlan
      ? automationPlan.steps.filter((step) => step.requiresHuman).map((step) => step.id)
      : [],
    missing: submissionPacket?.missing || [],
    attachmentSummary: (draft.attachments || []).map(attachmentRecord),
    notes: [
      "Official case number, lookup password, and submission time must be filled after the user submits on the official website.",
      "This record intentionally stores local workflow state without performing final submission.",
    ],
  };
}

export function updateCaseRecord(record, updates) {
  const next = structuredClone(record);
  next.updatedAt = new Date().toISOString();

  if (updates.localStatus) next.localStatus = updates.localStatus;
  if (updates.submissionStatus) next.submissionStatus = updates.submissionStatus;
  if (updates.automationStatus) next.automationStatus = updates.automationStatus;

  const existingCorrection = summarizeCorrection(next);
  const incomingCorrection = updates.official?.correction || {};
  const correctionStatus = incomingCorrection.status || updates.official?.correctionStatus || existingCorrection.status;

  next.official = {
    ...(next.official || {}),
    ...(updates.official || {}),
    correctionStatus,
    correction: {
      ...existingCorrection,
      ...incomingCorrection,
      status: correctionStatus,
      items: hasOwn(incomingCorrection, "items") ? incomingCorrection.items : existingCorrection.items,
    },
  };

  return next;
}

export function summarizeCaseRecord(record, caseDirectory = "") {
  const correction = summarizeCorrection(record);
  return {
    caseId: record.caseId || "",
    caseDirectory,
    jurisdiction: record.jurisdiction || "",
    violationType: record.violationType || "",
    createdAt: record.createdAt || "",
    updatedAt: record.updatedAt || "",
    localStatus: record.localStatus || "",
    submissionStatus: record.submissionStatus || "",
    automationStatus: record.automationStatus || "",
    officialCaseNumber: record.official?.caseNumber || "",
    submittedAt: record.official?.submittedAt || "",
    correctionStatus: correction.status,
    correctionDueAt: correction.dueAt,
    correctionItemCount: correction.items.length,
    attachmentCount: record.attachmentSummary?.length || 0,
    missingCount: record.missing?.length || 0,
    requiredHumanStopCount: record.requiredHumanStops?.length || 0,
  };
}
