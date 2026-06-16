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
