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
const VALID_REVIEW_STATUSES = new Set(["confirmed_by_user"]);
const VALID_FIELD_REVIEW_KEYS = new Set(["plate", "district", "road", "addressNote"]);
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

function nullableNumber(value) {
  return typeof value === "number" || value === null;
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

function validateLocationReview(review) {
  const issues = [];

  if (review === null || review === undefined) {
    return issues;
  }
  if (typeof review !== "object" || Array.isArray(review)) {
    return ["locationReview.invalid_object"];
  }
  if (hasOwn(review, "status") && !VALID_REVIEW_STATUSES.has(review.status)) {
    issues.push("locationReview.status.invalid");
  }
  for (const field of ["confirmedAt", "candidateLabel", "source", "addressLabel", "reverseGeocodeStatus", "district", "road", "addressNote", "note", "confirmedLocationId"]) {
    if (hasOwn(review, field) && !stringValue(review[field])) {
      issues.push(`locationReview.${field}.invalid_type`);
    }
  }
  for (const field of ["latitude", "longitude"]) {
    if (hasOwn(review, field) && !nullableNumber(review[field])) {
      issues.push(`locationReview.${field}.invalid_type`);
    }
  }
  for (const field of ["evidenceFiles", "matchReasons"]) {
    if (hasOwn(review, field) && !Array.isArray(review[field])) {
      issues.push(`locationReview.${field}.invalid_type`);
    }
  }

  return issues;
}

function validateFieldReview(review) {
  const issues = [];

  if (review === null || review === undefined) {
    return issues;
  }
  if (typeof review !== "object" || Array.isArray(review)) {
    return ["fieldReview.invalid_object"];
  }

  for (const [field, value] of Object.entries(review)) {
    const prefix = `fieldReview.${field}`;
    if (!VALID_FIELD_REVIEW_KEYS.has(field)) {
      issues.push(`${prefix}.unknown_field`);
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      issues.push(`${prefix}.invalid_object`);
      continue;
    }
    if (hasOwn(value, "status") && !VALID_REVIEW_STATUSES.has(value.status)) {
      issues.push(`${prefix}.status.invalid`);
    }
    for (const key of ["confirmedAt", "value", "source", "evidence"]) {
      if (hasOwn(value, key) && !stringValue(value[key])) {
        issues.push(`${prefix}.${key}.invalid_type`);
      }
    }
    if (hasOwn(value, "confidence") && !nullableNumber(value.confidence)) {
      issues.push(`${prefix}.confidence.invalid_type`);
    }
    if (hasOwn(value, "requiresReview") && typeof value.requiresReview !== "boolean") {
      issues.push(`${prefix}.requiresReview.invalid_type`);
    }
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
  for (const field of ["plate", "occurredAt", "district", "road", "fact", "description", "createdAt", "updatedAt"]) {
    if (hasOwn(draft, field) && !stringValue(draft[field])) {
      issues.push(`draft.${field}.invalid_type`);
    }
  }
  if (hasOwn(draft, "files") && !Array.isArray(draft.files)) {
    issues.push("draft.files.invalid_type");
  } else if (Array.isArray(draft.files)) {
    if (draft.files.length < 1) issues.push("draft.files.empty");
    if (draft.files.length > 5) issues.push("draft.files.too_many");
    draft.files.forEach((file, index) => {
      if (!stringValue(file)) issues.push(`draft.files.${index}.invalid_type`);
    });
  }
  if (hasOwn(draft, "attachments") && !Array.isArray(draft.attachments)) {
    issues.push("draft.attachments.invalid_type");
  } else if (Array.isArray(draft.attachments)) {
    if (draft.attachments.length < 1) issues.push("draft.attachments.empty");
    if (draft.attachments.length > 5) issues.push("draft.attachments.too_many");
    draft.attachments.forEach((attachment, index) => {
      issues.push(...validateAttachment(attachment, index));
    });
  }
  if (hasOwn(draft, "locationReview")) {
    issues.push(...validateLocationReview(draft.locationReview));
  }
  if (hasOwn(draft, "fieldReview")) {
    issues.push(...validateFieldReview(draft.fieldReview));
  }

  return {
    status: issues.length === 0 ? "ok" : "invalid",
    issues,
  };
}
