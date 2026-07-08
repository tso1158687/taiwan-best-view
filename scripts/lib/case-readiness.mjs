import { createSubmissionPacket } from "./submission-packet.mjs";
import { summarizeReporterProfile } from "./reporter-profile.mjs";

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function statusFromMissing(missing) {
  return missing.length === 0 ? "ready_for_human_review" : "needs_missing_data";
}

function summarizeOfficialPreflight({ jurisdiction, officialPreflight, now = new Date() }) {
  if (!officialPreflight) {
    return {
      status: "not_provided",
      issues: ["official_preflight.missing"],
      note: "Run a read-only official preflight before opening the official site for human review.",
    };
  }

  const issues = [];
  const generatedAt = officialPreflight.generatedAt || "";
  const generatedTime = generatedAt ? new Date(generatedAt) : null;
  const ageHours = generatedTime && !Number.isNaN(generatedTime.getTime())
    ? Math.round(((now.getTime() - generatedTime.getTime()) / 36e5) * 10) / 10
    : null;

  if (officialPreflight.jurisdiction !== jurisdiction) {
    issues.push("official_preflight.jurisdiction_mismatch");
  }
  if (officialPreflight.mode !== "live_official_read_only_preflight") {
    issues.push("official_preflight.invalid_mode");
  }
  if (officialPreflight.status !== "ok") {
    issues.push("official_preflight.not_ok");
  }
  if (officialPreflight.externalSideEffects !== false) {
    issues.push("official_preflight.side_effects_not_false");
  }
  if (officialPreflight.dataFilled !== false || officialPreflight.fileUploaded !== false || officialPreflight.finalSubmitTriggered !== false) {
    issues.push("official_preflight.not_read_only");
  }
  if (ageHours === null) {
    issues.push("official_preflight.generated_at_missing");
  } else if (ageHours > 24) {
    issues.push("official_preflight.stale");
  }

  return {
    status: issues.length === 0 ? "ok" : "needs_recheck",
    generatedAt,
    ageHours,
    jurisdiction: officialPreflight.jurisdiction || "",
    preflightStatus: officialPreflight.status || "",
    present: officialPreflight.summary?.present ?? null,
    deferred: officialPreflight.summary?.deferred ?? null,
    missing: officialPreflight.summary?.missing || [],
    issues,
    note: issues.length === 0
      ? "Official preflight is fresh, read-only, and matches this case jurisdiction."
      : "Re-run the read-only official preflight before opening the official site.",
  };
}

function summarizeAttachmentReadiness({ draft, packet }) {
  const packetAttachments = packet.attachments || [];
  const draftAttachments = draft.attachments || [];
  const issues = [];

  if (packetAttachments.length === 0) {
    issues.push("attachments.missing");
  }

  for (const attachment of packetAttachments) {
    if (!attachment.acceptedByOfficial) {
      issues.push(`attachments.${attachment.submissionName}.unsupported`);
    }
  }

  for (const attachment of draftAttachments) {
    if (attachment.needsConversion && attachment.conversionStatus !== "converted") {
      issues.push(`attachments.${attachment.originalName}.conversion_incomplete`);
    }
    if (attachment.exifStatus === "missing" || attachment.exifStatus === "not_checked") {
      issues.push(`attachments.${attachment.originalName}.exif_needs_review`);
    }
    if (attachment.metadataEmbeddingStatus === "sidecar_only") {
      issues.push(`attachments.${attachment.originalName}.metadata_sidecar_only`);
    }
  }

  return {
    status: issues.length === 0 ? "ready_for_human_review" : "needs_review",
    count: packetAttachments.length,
    submissionFiles: packetAttachments.map((attachment) => attachment.submissionName),
    issues: unique(issues),
  };
}

function summarizeLocationReadiness(draft) {
  const assistance = draft.locationAssistance || {};
  const candidates = assistance.candidates || [];
  const review = draft.locationReview || null;

  if (review?.source) {
    return {
      status: "candidate_adopted_needs_final_confirmation",
      candidateCount: candidates.length,
      adoptedSource: review.source,
      adoptedLabel: review.label || "",
      note: "A location candidate was adopted locally. The exact road, direction, and legal location still need human confirmation.",
    };
  }

  if (candidates.length > 0) {
    return {
      status: "needs_user_confirmation",
      candidateCount: candidates.length,
      adoptedSource: "",
      adoptedLabel: "",
      note: "Review GPS/map candidates and adopt or manually enter the exact official-form location.",
    };
  }

  return {
    status: "manual_required",
    candidateCount: 0,
    adoptedSource: "",
    adoptedLabel: "",
    note: "No location candidate is available. Enter district, road, and address note manually from the evidence.",
  };
}

function summarizePhotoAnalysisReadiness(draft) {
  const analysis = draft.photoAnalysis || {};
  const plateCandidates = analysis.plateCandidates || [];
  const locationTextCandidates = analysis.locationTextCandidates || [];
  const topPlateCandidate = plateCandidates[0] || null;

  return {
    status: plateCandidates.length > 0 || locationTextCandidates.length > 0 ? "needs_user_confirmation" : "manual_required",
    engine: analysis.engine || "",
    plateCandidateCount: plateCandidates.length,
    topPlateCandidate: topPlateCandidate
      ? {
          text: topPlateCandidate.text,
          confidence: topPlateCandidate.confidence,
          pattern: topPlateCandidate.pattern,
          requiresReview: topPlateCandidate.requiresReview,
        }
      : null,
    locationTextCandidateCount: locationTextCandidates.length,
  };
}

function nextStepsForReport({ packet, reporterProfile, locationReadiness, officialPreflightReadiness }) {
  const steps = [];

  if (packet.missing.length > 0) {
    steps.push(`Fill or confirm missing fields: ${packet.missing.join(", ")}`);
  }

  if (!reporterProfile) {
    steps.push("Create and validate a local reporter profile, or pass an existing ignored reporter profile to this review command.");
  }

  if (locationReadiness.status !== "candidate_adopted_needs_final_confirmation") {
    steps.push("Review the location candidates and manually confirm the official district, road, and address note.");
  }

  if (officialPreflightReadiness.status !== "ok") {
    steps.push("Before any live official-site run, re-check the official preflight for the target jurisdiction.");
  }
  steps.push("Complete CAPTCHA, Email verification, declarations, pre-submit review, and final submit manually.");

  if (packet.status === "ready_for_human_review" && officialPreflightReadiness.status === "ok") {
    steps.unshift("The packet has enough local data to open the official website for human review.");
  }

  return unique(steps);
}

export async function createCaseReadinessReport({ draft, reporterProfile = null, draftPath = "", officialPreflight = null, now = new Date() }) {
  const packet = await createSubmissionPacket({ draft, reporterProfile });
  const caseMissing = packet.missing.filter((field) => field.startsWith("case.") || field === "attachments");
  const reporterMissing = packet.missing.filter((field) => field.startsWith("reporter."));
  const attachmentReadiness = summarizeAttachmentReadiness({ draft, packet });
  const locationReadiness = summarizeLocationReadiness(draft);
  const photoAnalysisReadiness = summarizePhotoAnalysisReadiness(draft);
  const reporterSummary = summarizeReporterProfile(reporterProfile);
  const officialPreflightReadiness = summarizeOfficialPreflight({
    jurisdiction: packet.jurisdiction,
    officialPreflight,
    now,
  });

  const reviewItems = [
    {
      id: "case_required_fields",
      status: statusFromMissing(caseMissing),
      missing: caseMissing,
    },
    {
      id: "reporter_profile",
      status: reporterSummary.status,
      missing: reporterSummary.missing,
      invalid: reporterSummary.invalid,
      optionalMissing: reporterSummary.optionalMissing,
      presentFields: reporterSummary.presentFields,
    },
    {
      id: "attachments",
      ...attachmentReadiness,
    },
    {
      id: "photo_analysis",
      ...photoAnalysisReadiness,
    },
    {
      id: "location_review",
      ...locationReadiness,
    },
    {
      id: "official_human_stops",
      status: "human_required",
      stopBefore: packet.official.stopBefore,
    },
    {
      id: "official_preflight",
      ...officialPreflightReadiness,
    },
  ];

  const canOpenOfficialSiteForHumanReview =
    packet.status === "ready_for_human_review" &&
    officialPreflightReadiness.status === "ok";

  return {
    generatedAt: new Date().toISOString(),
    draftPath,
    caseId: draft.caseId || "",
    jurisdiction: packet.jurisdiction,
    officialUrl: packet.official.url,
    status: canOpenOfficialSiteForHumanReview ? "ready_for_human_review" : packet.status === "ready_for_human_review" ? "needs_official_preflight" : packet.status,
    canOpenOfficialSiteForHumanReview,
    finalSubmitAutomated: false,
    missing: {
      all: packet.missing,
      case: caseMissing,
      reporter: reporterMissing,
    },
    reporterProfile: reporterSummary,
    officialPreflight: officialPreflightReadiness,
    reviewItems,
    manualBoundaries: packet.manualBoundaries,
    stopBefore: packet.official.stopBefore,
    nextSteps: nextStepsForReport({ packet, reporterProfile, locationReadiness, officialPreflightReadiness }),
  };
}
