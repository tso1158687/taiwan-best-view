import { stat } from "node:fs/promises";
import { validateReporterProfile } from "./reporter-profile.mjs";

const TAIPEI_OFFICIAL_URL = "https://prsweb.tcpd.gov.tw/";
const NEW_TAIPEI_OFFICIAL_URL = "https://tvrs.ntpd.gov.tw/";
const MAX_TOTAL_BYTES = 80 * 1024 * 1024;

const TAIPEI_REPORTER_FIELDS = [
  "identityType",
  "identityNumber",
  "name",
  "phone",
  "address",
  "email",
];

const NEW_TAIPEI_REPORTER_FIELDS = [
  "identityType",
  "identityNumber",
  "name",
  "phone",
  "address",
  "email",
];

function missingFields(source, fieldNames, prefix) {
  return fieldNames
    .filter((fieldName) => !String(source?.[fieldName] || "").trim())
    .map((fieldName) => `${prefix}.${fieldName}`);
}

function splitPlate(plate) {
  const normalized = String(plate || "").trim().toUpperCase();
  const [prefix, suffix] = normalized.split("-");
  return {
    raw: normalized,
    prefix: suffix ? prefix : "",
    suffix: suffix || normalized,
  };
}

function formatTaiwanDateTime(value) {
  if (!value) {
    return {
      date: "",
      time: "",
      hour: "",
      minute: "",
    };
  }

  return {
    date: value.slice(0, 10),
    time: value.slice(11, 16),
    hour: value.slice(11, 13),
    minute: value.slice(14, 16),
  };
}

async function attachmentSummary(attachments) {
  const summaries = [];
  for (const attachment of attachments || []) {
    const fileStat = await stat(attachment.submissionPath);
    summaries.push({
      originalName: attachment.originalName,
      submissionName: attachment.submissionName,
      submissionPath: attachment.submissionPath,
      extension: attachment.submissionExtension,
      size: fileStat.size,
      acceptedByOfficial: attachment.acceptedByOfficial,
      conversionStatus: attachment.conversionStatus,
      exifStatus: attachment.exifStatus,
      gpsStatus: attachment.gpsStatus,
    });
  }

  return summaries;
}

function createBasePacket({ draft, reporterProfile, attachments }) {
  const missing = [
    ...missingFields(draft, ["plate", "occurredAt", "district", "road", "fact", "description"], "case"),
  ];

  const totalAttachmentBytes = attachments.reduce((sum, attachment) => sum + attachment.size, 0);
  if (attachments.length === 0) missing.push("attachments");
  if (attachments.length > 5) missing.push("attachments.too_many");
  if (totalAttachmentBytes > MAX_TOTAL_BYTES) missing.push("attachments.too_large");
  for (const attachment of attachments) {
    if (!attachment.acceptedByOfficial) {
      missing.push(`attachments.${attachment.submissionName}.unsupported`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    jurisdiction: draft.jurisdiction,
    status: missing.length === 0 ? "ready_for_human_review" : "needs_missing_data",
    missing,
    manualBoundaries: [
      "User must verify all facts, plate, time, and location before submission.",
      "User must complete Email verification, CAPTCHA, identity declarations, and final submission personally.",
      "Automation must stop before any final submit action.",
    ],
    reporterProfile: {
      provided: Boolean(reporterProfile),
      missing: [],
      invalid: [],
    },
    caseData: {
      violationType: draft.violationType,
      plate: splitPlate(draft.plate),
      occurredAt: draft.occurredAt,
      occurredAtParts: formatTaiwanDateTime(draft.occurredAt),
      district: draft.district,
      road: draft.road,
      addressNote: draft.addressNote,
      fact: draft.fact,
      description: draft.description,
      fieldSuggestions: draft.fieldSuggestions || null,
      locationAssistance: draft.locationAssistance || null,
      photoAnalysis: draft.photoAnalysis
        ? {
            status: draft.photoAnalysis.status,
            engine: draft.photoAnalysis.engine,
            plateCandidates: draft.photoAnalysis.plateCandidates || [],
            locationTextCandidates: draft.photoAnalysis.locationTextCandidates || [],
          }
        : null,
    },
    attachments,
  };
}

export async function createSubmissionPacket({ draft, reporterProfile = null }) {
  const attachments = await attachmentSummary(draft.attachments || []);
  const packet = createBasePacket({ draft, reporterProfile, attachments });

  if (draft.jurisdiction === "taipei") {
    packet.official = {
      name: "臺北市交通違規檢舉專區",
      url: TAIPEI_OFFICIAL_URL,
      automationPhase: "taipei_pre_email_verification_packet",
      stopBefore: [
        "send_email_verification",
        "personal_data_collection_statement",
        "privacy_policy_statement",
        "truthfulness_statement",
        "final_submit",
      ],
    };
    const validation = validateReporterProfile(reporterProfile);
    packet.reporterProfile.missing = reporterProfile
      ? validation.missing
      : missingFields(reporterProfile, TAIPEI_REPORTER_FIELDS, "reporter");
    packet.reporterProfile.invalid = validation.invalid;
    packet.formMapping = {
      reporter: {
        identityType: reporterProfile?.identityType || "",
        identityNumber: reporterProfile?.identityNumber || "",
        name: reporterProfile?.name || "",
        phone: reporterProfile?.phone || "",
        phoneExtension: reporterProfile?.phoneExtension || "",
        address: reporterProfile?.address || "",
        email: reporterProfile?.email || "",
      },
      case: {
        date: packet.caseData.occurredAtParts.date,
        time: packet.caseData.occurredAtParts.time,
        plateType: "普通車",
        platePrefix: packet.caseData.plate.prefix,
        plateSuffix: packet.caseData.plate.suffix,
        district: draft.district,
        road: draft.road,
        addressNote: draft.addressNote,
        fact: draft.fact,
        description: draft.description,
      },
    };
  } else if (draft.jurisdiction === "new_taipei") {
    packet.official = {
      name: "新北市交通違規檢舉系統",
      url: NEW_TAIPEI_OFFICIAL_URL,
      automationPhase: "new_taipei_pre_captcha_email_packet",
      stopBefore: [
        "captcha",
        "email_verification_check",
        "identity_declaration",
        "final_submit",
      ],
    };
    const validation = validateReporterProfile(reporterProfile);
    packet.reporterProfile.missing = reporterProfile
      ? validation.missing
      : missingFields(reporterProfile, NEW_TAIPEI_REPORTER_FIELDS, "reporter");
    packet.reporterProfile.invalid = validation.invalid;
    packet.formMapping = {
      case: {
        vehicleType: "汽車",
        plateType: "普通車",
        platePrefix: packet.caseData.plate.prefix,
        plateSuffix: packet.caseData.plate.suffix,
        date: packet.caseData.occurredAtParts.date,
        hour: packet.caseData.occurredAtParts.hour,
        minute: packet.caseData.occurredAtParts.minute,
        cityScope: "新北市",
        district: draft.district,
        street: draft.road,
        addressNote: draft.addressNote,
        fact: draft.fact,
        description: draft.description,
      },
      reporter: {
        identityType: reporterProfile?.identityType || "",
        identityNumber: reporterProfile?.identityNumber || "",
        name: reporterProfile?.name || "",
        phone: reporterProfile?.phone || "",
        address: reporterProfile?.address || "",
        email: reporterProfile?.email || "",
      },
    };
  } else {
    throw new Error(`Unsupported jurisdiction: ${draft.jurisdiction}`);
  }

  packet.missing = [...packet.missing, ...packet.reporterProfile.missing, ...packet.reporterProfile.invalid];
  packet.status = packet.missing.length === 0 ? "ready_for_human_review" : "needs_missing_data";

  return packet;
}
