import { readFile, writeFile } from "node:fs/promises";
import { pathExists } from "./system.mjs";

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_RADIUS_METERS = 180;

export const DEFAULT_CONFIRMED_LOCATIONS_PATH = "confirmed-locations.local.json";

export function emptyConfirmedLocationLibrary() {
  return {
    schemaVersion: 1,
    locations: [],
  };
}

function hasValue(value) {
  return String(value || "").trim().length > 0;
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function locationKey(location) {
  return [
    location.jurisdiction,
    normalizeText(location.district),
    normalizeText(location.road),
    normalizeText(location.addressNote),
  ].join("|");
}

function locationLabel(location) {
  return [location.district, location.road, location.addressNote].filter(hasValue).join("");
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  if (
    typeof a?.latitude !== "number" ||
    typeof a?.longitude !== "number" ||
    typeof b?.latitude !== "number" ||
    typeof b?.longitude !== "number"
  ) {
    return null;
  }

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const deltaLat = toRadians(b.latitude - a.latitude);
  const deltaLng = toRadians(b.longitude - a.longitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function mapLinks(location) {
  if (typeof location.latitude !== "number" || typeof location.longitude !== "number") {
    return {};
  }

  return {
    apple: `https://maps.apple.com/?ll=${location.latitude},${location.longitude}`,
    google: `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`,
  };
}

export async function readConfirmedLocationLibrary(path = DEFAULT_CONFIRMED_LOCATIONS_PATH) {
  if (!(await pathExists(path))) {
    return emptyConfirmedLocationLibrary();
  }

  const parsed = JSON.parse(await readFile(path, "utf8"));
  return {
    schemaVersion: parsed.schemaVersion || 1,
    locations: Array.isArray(parsed.locations) ? parsed.locations : [],
  };
}

export async function writeConfirmedLocationLibrary(library, path = DEFAULT_CONFIRMED_LOCATIONS_PATH) {
  const payload = {
    schemaVersion: 1,
    locations: Array.isArray(library.locations) ? library.locations : [],
  };
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`);
  return payload;
}

export function createConfirmedLocationFromDraft(draft, now = new Date().toISOString()) {
  if (!hasValue(draft?.district) || !hasValue(draft?.road)) {
    throw new Error("Draft must have district and road before recording a confirmed location.");
  }

  const review = draft.locationReview || {};
  const latitude = typeof review.latitude === "number" ? review.latitude : null;
  const longitude = typeof review.longitude === "number" ? review.longitude : null;
  const location = {
    id: "",
    jurisdiction: draft.jurisdiction,
    district: String(draft.district).trim(),
    road: String(draft.road).trim(),
    addressNote: String(draft.addressNote || review.addressNote || "").trim(),
    latitude,
    longitude,
    label: "",
    source: review.source || "manual",
    evidenceFiles: Array.isArray(review.evidenceFiles) ? review.evidenceFiles : [],
    createdAt: now,
    updatedAt: now,
    lastConfirmedAt: now,
    useCount: 1,
    exampleCaseIds: draft.caseId ? [draft.caseId] : [],
  };
  location.label = locationLabel(location);
  location.id = locationKey(location);

  return location;
}

export function addConfirmedLocation(library, draft, now = new Date().toISOString()) {
  const next = {
    schemaVersion: library?.schemaVersion || 1,
    locations: Array.isArray(library?.locations) ? [...library.locations] : [],
  };
  const incoming = createConfirmedLocationFromDraft(draft, now);
  const incomingKey = locationKey(incoming);
  const existingIndex = next.locations.findIndex((location) => locationKey(location) === incomingKey);

  if (existingIndex >= 0) {
    const existing = next.locations[existingIndex];
    next.locations[existingIndex] = {
      ...existing,
      ...incoming,
      createdAt: existing.createdAt || incoming.createdAt,
      useCount: (existing.useCount || 0) + 1,
      exampleCaseIds: [...new Set([...(existing.exampleCaseIds || []), ...(incoming.exampleCaseIds || [])])].slice(-5),
    };
    return {
      library: next,
      location: next.locations[existingIndex],
      action: "updated",
    };
  }

  next.locations.push(incoming);
  return {
    library: next,
    location: incoming,
    action: "created",
  };
}

function ocrTextMatches(location, photoAnalysis) {
  const locationText = normalizeText(`${location.label}${location.addressNote}${location.road}`);
  return (photoAnalysis?.locationTextCandidates || [])
    .map((candidate) => candidate.text)
    .filter(hasValue)
    .filter((text) => {
      const normalized = normalizeText(text);
      return normalized.length >= 2 && (locationText.includes(normalized) || normalized.includes(normalizeText(location.road)));
    });
}

function closestGpsMatch(location, locationAssistance) {
  const matches = (locationAssistance?.candidates || [])
    .map((candidate) => ({
      candidate,
      distance: distanceMeters(location, candidate),
    }))
    .filter((match) => typeof match.distance === "number")
    .sort((a, b) => a.distance - b.distance);

  return matches[0] || null;
}

export function createConfirmedLocationCandidates({
  library,
  jurisdiction,
  locationAssistance,
  photoAnalysis,
  radiusMeters = DEFAULT_RADIUS_METERS,
}) {
  const locations = (library?.locations || []).filter((location) => location.jurisdiction === jurisdiction);

  return locations
    .map((location) => {
      const reasons = [];
      const ocrMatches = ocrTextMatches(location, photoAnalysis);
      const gpsMatch = closestGpsMatch(location, locationAssistance);

      if (gpsMatch && gpsMatch.distance <= radiusMeters) {
        reasons.push(`within ${Math.round(gpsMatch.distance)}m of confirmed location`);
      }

      for (const text of ocrMatches.slice(0, 2)) {
        reasons.push(`matches OCR text: ${text}`);
      }

      if (reasons.length === 0) {
        return null;
      }

      const latitude = typeof location.latitude === "number" ? location.latitude : gpsMatch?.candidate.latitude ?? null;
      const longitude = typeof location.longitude === "number" ? location.longitude : gpsMatch?.candidate.longitude ?? null;

      return {
        source: "confirmed_location",
        confidence: "needs_review",
        label: location.label,
        latitude,
        longitude,
        district: location.district,
        road: location.road,
        addressNote: location.addressNote,
        evidenceFiles: gpsMatch?.candidate.evidenceFiles || location.evidenceFiles || [],
        addressLabel: location.label,
        reverseGeocode: {
          status: "confirmed_location",
          subLocality: location.district,
          thoroughfare: location.road,
        },
        maps: mapLinks({ latitude, longitude }),
        note: "Matched a locally confirmed frequent location. Confirm it against the current photo evidence before submission.",
        confirmedLocationId: location.id || locationKey(location),
        matchReasons: reasons,
        useCount: location.useCount || 1,
        lastConfirmedAt: location.lastConfirmedAt || "",
      };
    })
    .filter(Boolean);
}

export function mergeConfirmedLocationCandidates({ locationAssistance, candidates }) {
  if (!candidates || candidates.length === 0) {
    return locationAssistance;
  }

  const existing = locationAssistance || {
    candidates: [],
    missingGpsAttachments: [],
    status: "manual_required",
  };

  return {
    ...existing,
    candidates: [...(existing.candidates || []), ...candidates],
    confirmedLocationCandidateCount: candidates.length,
    status: "needs_review",
  };
}
