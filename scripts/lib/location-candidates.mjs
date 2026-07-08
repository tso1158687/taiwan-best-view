function roundCoordinate(value) {
  return Math.round(value * 1000000) / 1000000;
}

function hasGps(attachment) {
  return typeof attachment.latitude === "number" && typeof attachment.longitude === "number";
}

function uniqueOcrLocationCandidates(candidates) {
  const seen = new Set();
  const unique = [];

  for (const candidate of candidates) {
    const key = candidate.text;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

export function createLocationCandidates(attachments) {
  const gpsAttachments = attachments.filter(hasGps);
  const missingGpsAttachments = attachments
    .filter((attachment) => !hasGps(attachment))
    .map((attachment) => attachment.originalName);

  const candidates = gpsAttachments.map((attachment) => {
    const latitude = roundCoordinate(attachment.latitude);
    const longitude = roundCoordinate(attachment.longitude);
    const label = `${latitude}, ${longitude}`;

    return {
      source: "exif_gps",
      confidence: "needs_review",
      label,
      latitude,
      longitude,
      evidenceFiles: [attachment.originalName],
      maps: {
        apple: `https://maps.apple.com/?ll=${latitude},${longitude}`,
        google: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
      },
      note: "EXIF GPS is a starting point only. Confirm the exact road, address, and direction from the photo evidence.",
    };
  });

  return {
    candidates,
    missingGpsAttachments,
    status: candidates.length > 0 ? "needs_review" : "manual_required",
  };
}

export function createOcrLocationCandidates(photoAnalysis) {
  const candidates = uniqueOcrLocationCandidates(photoAnalysis?.locationTextCandidates || []);

  return candidates.map((candidate) => ({
    source: "ocr_text",
    confidence: "needs_review",
    confidenceScore: candidate.confidence,
    label: candidate.text,
    addressNote: candidate.text,
    evidenceFiles: candidate.fileName ? [candidate.fileName] : [],
    maps: {},
    note: "OCR text is a location clue only. Confirm the exact district, road, address, and direction from the photo evidence.",
  }));
}

export function mergeOcrLocationCandidates({ locationAssistance, candidates }) {
  const mergedCandidates = [
    ...(locationAssistance.candidates || []),
    ...candidates,
  ];

  return {
    ...locationAssistance,
    candidates: mergedCandidates,
    ocrLocationCandidateCount: candidates.length,
    status: mergedCandidates.length > 0 ? "needs_review" : locationAssistance.status,
  };
}
