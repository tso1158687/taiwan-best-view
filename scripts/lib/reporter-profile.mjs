import { readFile } from "node:fs/promises";

export const REPORTER_PROFILE_FIELDS = [
  "identityType",
  "identityNumber",
  "name",
  "phone",
  "address",
  "email",
];

export const OPTIONAL_REPORTER_PROFILE_FIELDS = [
  "phoneExtension",
  "residencePermitFrontFile",
];

export const IDENTITY_TYPES = new Set(["national_id", "residence_permit", "passport"]);

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function validEmail(value) {
  if (!hasValue(value)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

function validIdentityType(value) {
  return IDENTITY_TYPES.has(String(value || "").trim());
}

function invalidFields(profile) {
  const invalid = [];
  if (hasValue(profile?.identityType) && !validIdentityType(profile.identityType)) {
    invalid.push("reporter.identityType");
  }
  if (hasValue(profile?.email) && !validEmail(profile.email)) {
    invalid.push("reporter.email");
  }
  return invalid;
}

export function validateReporterProfile(profile) {
  const missing = REPORTER_PROFILE_FIELDS
    .filter((field) => !hasValue(profile?.[field]))
    .map((field) => `reporter.${field}`);
  const invalid = invalidFields(profile);
  const optionalMissing = OPTIONAL_REPORTER_PROFILE_FIELDS
    .filter((field) => !hasValue(profile?.[field]))
    .map((field) => `reporter.${field}`);

  return {
    status: missing.length === 0 && invalid.length === 0 ? "ready" : "needs_missing_data",
    missing,
    invalid,
    optionalMissing,
    presentFields: REPORTER_PROFILE_FIELDS
      .filter((field) => hasValue(profile?.[field]))
      .map((field) => `reporter.${field}`),
  };
}

export function summarizeReporterProfile(profile) {
  const validation = validateReporterProfile(profile);
  return {
    status: validation.status,
    missing: validation.missing,
    invalid: validation.invalid,
    optionalMissing: validation.optionalMissing,
    presentFields: validation.presentFields,
    hasPhoneExtension: hasValue(profile?.phoneExtension),
    hasResidencePermitFrontFile: hasValue(profile?.residencePermitFrontFile),
  };
}

export async function readReporterProfile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
