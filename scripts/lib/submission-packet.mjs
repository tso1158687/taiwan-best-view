import { stat } from "node:fs/promises";
import { splitPlateForForm } from "./plate-normalization.mjs";
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

function totalAttachmentBytes(attachments) {
  return attachments.reduce((sum, attachment) => sum + (attachment.size || 0), 0);
}

function createPreSubmitReview(packet) {
  const attachments = packet.attachments || [];

  return {
    status: "manual_required",
    privacy: "Reporter profile values are intentionally omitted from this summary.",
    case: {
      jurisdiction: packet.jurisdiction,
      violationType: packet.caseData.violationType,
      plate: {
        prefix: packet.caseData.plate.prefix,
        suffix: packet.caseData.plate.suffix,
      },
      occurredAt: packet.caseData.occurredAt,
      district: packet.caseData.district,
      road: packet.caseData.road,
      addressNote: packet.caseData.addressNote,
      fact: packet.caseData.fact,
      description: packet.caseData.description,
      locationReviewStatus: packet.caseData.locationReview?.status || packet.caseData.locationAssistance?.status || "",
      confirmedFieldNames: Object.keys(packet.caseData.fieldReview || {}),
    },
    attachments: {
      count: attachments.length,
      totalBytes: totalAttachmentBytes(attachments),
      items: attachments.map((attachment) => ({
        submissionName: attachment.submissionName,
        extension: attachment.extension,
        size: attachment.size,
        acceptedByOfficial: attachment.acceptedByOfficial,
        conversionStatus: attachment.conversionStatus,
        exifStatus: attachment.exifStatus,
        gpsStatus: attachment.gpsStatus,
      })),
    },
    reporterProfile: {
      provided: packet.reporterProfile.provided,
      missingCount: packet.reporterProfile.missing.length,
      invalidCount: packet.reporterProfile.invalid.length,
      status: packet.reporterProfile.missing.length === 0 && packet.reporterProfile.invalid.length === 0 ? "ready" : "needs_missing_data",
    },
    officialStopBefore: packet.official?.stopBefore || [],
    checklist: [
      "確認違規時間、地點、車號、違規事實與照片證據一致。",
      "確認附件可上傳且 EXIF/GPS 狀態已人工檢查。",
      "確認檢舉人資料由本人填寫，且官方聲明由本人閱讀確認。",
      "最後送出必須由使用者本人操作。",
    ],
  };
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
      plate: splitPlateForForm(draft.plate),
      occurredAt: draft.occurredAt,
      occurredAtParts: formatTaiwanDateTime(draft.occurredAt),
      district: draft.district,
      road: draft.road,
      addressNote: draft.addressNote,
      fact: draft.fact,
      description: draft.description,
      fieldSuggestions: draft.fieldSuggestions || null,
      fieldReview: draft.fieldReview || {},
      locationReview: draft.locationReview || {},
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
  packet.preSubmitReview = createPreSubmitReview(packet);

  return packet;
}
