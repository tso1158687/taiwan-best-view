function roundCoordinate(value) {
  return Math.round(value * 1000000) / 1000000;
}

function hasGps(attachment) {
  return typeof attachment.latitude === "number" && typeof attachment.longitude === "number";
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
