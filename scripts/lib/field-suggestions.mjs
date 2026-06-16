function uniqueByValue(items) {
  const seen = new Set();
  const unique = [];

  for (const item of items) {
    const key = item.value;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique;
}

function reverseGeocodeSuggestions(locationAssistance, key, field) {
  return (locationAssistance?.candidates || [])
    .map((candidate) => candidate.reverseGeocode?.[key])
    .filter(Boolean)
    .map((value) => ({
      field,
      value,
      source: "reverse_geocode",
      confidence: 0.55,
      evidence: "EXIF GPS reverse geocode",
      requiresReview: true,
    }));
}

export function createFieldSuggestions({ photoAnalysis, locationAssistance }) {
  const plate = uniqueByValue((photoAnalysis?.plateCandidates || []).map((candidate) => ({
    field: "plate",
    value: candidate.text,
    source: "ocr_plate",
    confidence: candidate.confidence,
    evidence: candidate.sourceText,
    requiresReview: true,
  })));

  const addressNote = uniqueByValue([
    ...(photoAnalysis?.locationTextCandidates || []).map((candidate) => ({
      field: "addressNote",
      value: candidate.text,
      source: "ocr_location_text",
      confidence: candidate.confidence,
      evidence: candidate.text,
      requiresReview: true,
    })),
    ...(locationAssistance?.candidates || []).map((candidate) => ({
      field: "addressNote",
      value: candidate.reverseGeocode?.status === "ok" && candidate.addressLabel
        ? `GPS 反查 ${candidate.addressLabel}`
        : `GPS 候選 ${candidate.label}`,
      source: "exif_gps",
      confidence: 0.5,
      evidence: candidate.evidenceFiles.join(", "),
      maps: candidate.maps,
      requiresReview: true,
    })),
  ]);

  const road = uniqueByValue([
    ...(photoAnalysis?.locationTextCandidates || [])
      .filter((candidate) => /[路街巷弄]/.test(candidate.text))
      .map((candidate) => ({
        field: "road",
        value: candidate.text,
        source: "ocr_location_text",
        confidence: candidate.confidence,
        evidence: candidate.text,
        requiresReview: true,
      })),
    ...reverseGeocodeSuggestions(locationAssistance, "thoroughfare", "road"),
  ]);

  const district = uniqueByValue(reverseGeocodeSuggestions(locationAssistance, "subLocality", "district"));

  return {
    plate,
    district,
    road,
    addressNote,
    status: plate.length > 0 || district.length > 0 || road.length > 0 || addressNote.length > 0 ? "needs_review" : "empty",
  };
}
