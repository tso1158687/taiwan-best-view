const REQUIRED_DRAFT_FIELDS = [
  "jurisdiction",
  "violationType",
  "plate",
  "occurredAt",
  "district",
  "road",
  "fact",
  "description",
  "files",
  "attachments",
  "status",
];

const REQUIRED_ATTACHMENT_FIELDS = [
  "originalName",
  "submissionName",
  "originalExtension",
  "submissionExtension",
  "size",
  "type",
  "needsConversion",
  "conversionStatus",
  "exifStatus",
  "acceptedByOfficial",
];

const VALID_JURISDICTIONS = new Set(["taipei", "new_taipei"]);
const VALID_VIOLATION_TYPES = new Set(["illegal_parking"]);
const VALID_STATUSES = new Set(["draft", "ready_for_review", "submitted"]);
const VALID_CONVERSION_STATUSES = new Set(["not_required", "pending", "converted", "failed"]);
const VALID_EXIF_STATUSES = new Set(["not_checked", "pending", "preserved", "partial", "missing", "sidecar"]);
const VALID_GPS_STATUSES = new Set(["not_checked", "present", "missing"]);
const VALID_METADATA_EMBEDDING_STATUSES = new Set([
  "not_applicable",
  "sidecar_only",
  "attempted",
  "embedded",
  "failed_sidecar_fallback",
]);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function stringValue(value) {
  return typeof value === "string";
}

function addMissingFields({ target, fields, prefix, issues }) {
  for (const field of fields) {
    if (!hasOwn(target, field)) {
      issues.push(`${prefix}.${field}.missing`);
    }
  }
}

function validateAttachment(attachment, index) {
  const issues = [];
  const prefix = `attachments.${index}`;

  if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
    return [`${prefix}.invalid_object`];
  }

  addMissingFields({ target: attachment, fields: REQUIRED_ATTACHMENT_FIELDS, prefix, issues });
  for (const field of ["originalName", "submissionName", "originalExtension", "submissionExtension", "type"]) {
    if (hasOwn(attachment, field) && !stringValue(attachment[field])) {
      issues.push(`${prefix}.${field}.invalid_type`);
    }
  }
  if (hasOwn(attachment, "size") && (!Number.isInteger(attachment.size) || attachment.size < 0)) {
    issues.push(`${prefix}.size.invalid`);
  }
  if (hasOwn(attachment, "needsConversion") && typeof attachment.needsConversion !== "boolean") {
    issues.push(`${prefix}.needsConversion.invalid_type`);
  }
  if (hasOwn(attachment, "acceptedByOfficial") && typeof attachment.acceptedByOfficial !== "boolean") {
    issues.push(`${prefix}.acceptedByOfficial.invalid_type`);
  }
  if (hasOwn(attachment, "conversionStatus") && !VALID_CONVERSION_STATUSES.has(attachment.conversionStatus)) {
    issues.push(`${prefix}.conversionStatus.invalid`);
  }
  if (hasOwn(attachment, "exifStatus") && !VALID_EXIF_STATUSES.has(attachment.exifStatus)) {
    issues.push(`${prefix}.exifStatus.invalid`);
  }
  if (hasOwn(attachment, "gpsStatus") && !VALID_GPS_STATUSES.has(attachment.gpsStatus)) {
    issues.push(`${prefix}.gpsStatus.invalid`);
  }
  if (hasOwn(attachment, "metadataEmbeddingStatus") && !VALID_METADATA_EMBEDDING_STATUSES.has(attachment.metadataEmbeddingStatus)) {
    issues.push(`${prefix}.metadataEmbeddingStatus.invalid`);
  }

  return issues;
}

export function validateCaseDraft(draft) {
  const issues = [];

  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return {
      status: "invalid",
      issues: ["draft.invalid_object"],
    };
  }

  addMissingFields({ target: draft, fields: REQUIRED_DRAFT_FIELDS, prefix: "draft", issues });
  if (hasOwn(draft, "jurisdiction") && !VALID_JURISDICTIONS.has(draft.jurisdiction)) {
    issues.push("draft.jurisdiction.invalid");
  }
  if (hasOwn(draft, "violationType") && !VALID_VIOLATION_TYPES.has(draft.violationType)) {
    issues.push("draft.violationType.invalid");
  }
  if (hasOwn(draft, "status") && !VALID_STATUSES.has(draft.status)) {
    issues.push("draft.status.invalid");
  }
  for (const field of ["plate", "occurredAt", "district", "road", "fact", "description"]) {
    if (hasOwn(draft, field) && !stringValue(draft[field])) {
      issues.push(`draft.${field}.invalid_type`);
    }
  }
  if (hasOwn(draft, "files") && !Array.isArray(draft.files)) {
    issues.push("draft.files.invalid_type");
  } else if (Array.isArray(draft.files)) {
    if (draft.files.length > 5) issues.push("draft.files.too_many");
    draft.files.forEach((file, index) => {
      if (!stringValue(file)) issues.push(`draft.files.${index}.invalid_type`);
    });
  }
  if (hasOwn(draft, "attachments") && !Array.isArray(draft.attachments)) {
    issues.push("draft.attachments.invalid_type");
  } else if (Array.isArray(draft.attachments)) {
    if (draft.attachments.length > 5) issues.push("draft.attachments.too_many");
    draft.attachments.forEach((attachment, index) => {
      issues.push(...validateAttachment(attachment, index));
    });
  }

  return {
    status: issues.length === 0 ? "ok" : "invalid",
    issues,
  };
}
