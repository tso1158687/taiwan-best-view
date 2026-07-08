#!/usr/bin/env node
import {
  addConfirmedLocation,
  createConfirmedLocationCandidates,
  emptyConfirmedLocationLibrary,
  mergeConfirmedLocationCandidates,
} from "./lib/confirmed-locations.mjs";
import { createFieldSuggestions } from "./lib/field-suggestions.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const draft = {
    caseId: "case-confirmed-location-fixture",
    jurisdiction: "new_taipei",
    district: "新莊區",
    road: "中正路",
    addressNote: "傳品牛排前人行道",
    locationReview: {
      source: "exif_gps",
      latitude: 25.022475,
      longitude: 121.426317,
      evidenceFiles: ["IMG_2631.HEIC"],
    },
  };

  const created = addConfirmedLocation(emptyConfirmedLocationLibrary(), draft, "2026-07-09T00:00:00.000Z");
  assert(created.action === "created", "Expected first confirmed location to be created.");
  assert(created.location.label === "新莊區中正路傳品牛排前人行道", "Expected confirmed location label.");

  const updated = addConfirmedLocation(created.library, draft, "2026-07-09T01:00:00.000Z");
  assert(updated.action === "updated", "Expected duplicate confirmed location to be updated.");
  assert(updated.location.useCount === 2, "Expected confirmed location use count to increment.");

  const locationAssistance = {
    status: "needs_review",
    missingGpsAttachments: [],
    candidates: [
      {
        source: "exif_gps",
        confidence: "needs_review",
        label: "25.022476, 121.426318",
        latitude: 25.022476,
        longitude: 121.426318,
        evidenceFiles: ["IMG_2632.HEIC"],
        maps: {
          apple: "https://maps.apple.com/?ll=25.022476,121.426318",
          google: "https://www.google.com/maps/search/?api=1&query=25.022476,121.426318",
        },
      },
    ],
  };
  const candidates = createConfirmedLocationCandidates({
    library: updated.library,
    jurisdiction: "new_taipei",
    locationAssistance,
    photoAnalysis: {
      locationTextCandidates: [{ text: "傳品牛排", confidence: 0.8 }],
    },
  });

  assert(candidates.length === 1, "Expected one confirmed-location candidate.");
  assert(candidates[0].source === "confirmed_location", "Expected confirmed-location source.");
  assert(candidates[0].district === "新莊區", "Expected candidate district.");
  assert(candidates[0].road === "中正路", "Expected candidate road.");
  assert(candidates[0].matchReasons.some((reason) => reason.includes("within")), "Expected GPS distance match reason.");
  assert(candidates[0].matchReasons.some((reason) => reason.includes("OCR")), "Expected OCR match reason.");

  const merged = mergeConfirmedLocationCandidates({ locationAssistance, candidates });
  assert(merged.candidates.length === 2, "Expected confirmed candidate to be appended.");
  assert(merged.confirmedLocationCandidateCount === 1, "Expected confirmed-location candidate count.");
  assert(merged.status === "needs_review", "Expected merged assistance to need review.");
  const suggestions = createFieldSuggestions({
    photoAnalysis: { plateCandidates: [], locationTextCandidates: [] },
    locationAssistance: merged,
  });
  assert(suggestions.district.some((suggestion) => suggestion.value === "新莊區"), "Expected district suggestion from confirmed location.");
  assert(suggestions.road.some((suggestion) => suggestion.value === "中正路"), "Expected road suggestion from confirmed location.");
  assert(suggestions.addressNote.some((suggestion) => suggestion.source === "confirmed_location"), "Expected address note suggestion from confirmed location.");

  console.log(JSON.stringify({
    ok: true,
    action: updated.action,
    useCount: updated.location.useCount,
    candidateCount: candidates.length,
    verified: ["record confirmed location", "match by GPS distance", "match by OCR text", "field suggestions"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
