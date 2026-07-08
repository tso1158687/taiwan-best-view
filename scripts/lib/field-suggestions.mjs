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
    .filter((candidate) => candidate.reverseGeocode?.status === "ok")
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

function locationCandidateAddressNote(candidate) {
  if (candidate.source === "confirmed_location") {
    return candidate.addressNote || candidate.label;
  }
  if (candidate.source === "ocr_text") {
    return `OCR 線索：${candidate.addressNote || candidate.label}`;
  }
  if (candidate.reverseGeocode?.status === "ok" && candidate.addressLabel) {
    return `GPS 反查 ${candidate.addressLabel}`;
  }
  return `GPS 候選 ${candidate.label}`;
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
      value: locationCandidateAddressNote(candidate),
      source: candidate.source === "confirmed_location"
        ? "confirmed_location"
        : candidate.source === "ocr_text" ? "ocr_location_text" : "exif_gps",
      confidence: candidate.source === "confirmed_location" ? 0.7 : 0.5,
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
  for (const candidate of locationAssistance?.candidates || []) {
    if (candidate.source !== "confirmed_location") continue;
    if (candidate.district) {
      district.push({
        field: "district",
        value: candidate.district,
        source: "confirmed_location",
        confidence: 0.7,
        evidence: candidate.label,
        requiresReview: true,
      });
    }
    if (candidate.road) {
      road.push({
        field: "road",
        value: candidate.road,
        source: "confirmed_location",
        confidence: 0.7,
        evidence: candidate.label,
        requiresReview: true,
      });
    }
  }

  return {
    plate,
    district: uniqueByValue(district),
    road: uniqueByValue(road),
    addressNote,
    status: plate.length > 0 || district.length > 0 || road.length > 0 || addressNote.length > 0 ? "needs_review" : "empty",
  };
}
