import { readFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const ENCRYPTED_REPORTER_PROFILE_KIND = "encrypted_reporter_profile";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const KDF = "scrypt";
const KEY_LENGTH = 32;

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

function requirePassphrase(passphrase) {
  if (!hasValue(passphrase)) {
    throw new Error("Encrypted reporter profile requires REPORTER_PROFILE_PASSPHRASE.");
  }
}

async function deriveKey(passphrase, salt) {
  return scrypt(passphrase, salt, KEY_LENGTH);
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

export function isEncryptedReporterProfile(value) {
  return value?.kind === ENCRYPTED_REPORTER_PROFILE_KIND;
}

export async function encryptReporterProfile(profile, passphrase) {
  requirePassphrase(passphrase);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await deriveKey(passphrase, salt);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(profile), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    schemaVersion: 1,
    kind: ENCRYPTED_REPORTER_PROFILE_KIND,
    algorithm: ENCRYPTION_ALGORITHM,
    kdf: KDF,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export async function decryptReporterProfile(envelope, passphrase) {
  if (!isEncryptedReporterProfile(envelope)) {
    return envelope;
  }
  requirePassphrase(passphrase);
  if (envelope.algorithm !== ENCRYPTION_ALGORITHM || envelope.kdf !== KDF) {
    throw new Error("Unsupported encrypted reporter profile format.");
  }

  const key = await deriveKey(passphrase, Buffer.from(envelope.salt || "", "base64"));
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, Buffer.from(envelope.iv || "", "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag || "", "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext || "", "base64")),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8"));
}

export async function readReporterProfile(path, options = {}) {
  const profile = JSON.parse(await readFile(path, "utf8"));
  return decryptReporterProfile(profile, options.passphrase ?? process.env.REPORTER_PROFILE_PASSPHRASE);
}
