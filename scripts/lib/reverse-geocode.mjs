import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { commandExists, run } from "./system.mjs";

const SCRIPT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../reverse-geocode.swift");

export async function reverseGeocodeCoordinate({ latitude, longitude }) {
  if (!(await commandExists("swift"))) {
    return {
      status: "unavailable",
      reason: "swift_not_available",
      latitude,
      longitude,
    };
  }

  try {
    const { stdout } = await run("swift", [SCRIPT_PATH, String(latitude), String(longitude)]);
    const jsonStart = stdout.indexOf("{");
    if (jsonStart < 0) {
      return {
        status: "unavailable",
        reason: "reverse_geocoder_returned_no_json",
        latitude,
        longitude,
      };
    }
    return JSON.parse(stdout.slice(jsonStart));
  } catch (error) {
    return {
      status: "unavailable",
      reason: error.message,
      latitude,
      longitude,
    };
  }
}

export async function enrichLocationCandidatesWithReverseGeocode(locationAssistance) {
  const candidates = [];
  for (const candidate of locationAssistance.candidates || []) {
    if (typeof candidate.latitude !== "number" || typeof candidate.longitude !== "number") {
      candidates.push(candidate);
      continue;
    }

    const reverseGeocode = await reverseGeocodeCoordinate({
      latitude: candidate.latitude,
      longitude: candidate.longitude,
    });
    candidates.push({
      ...candidate,
      reverseGeocode,
      addressLabel: reverseGeocode.status === "ok" && reverseGeocode.formattedAddress
        ? reverseGeocode.formattedAddress
        : candidate.label,
    });
  }

  return {
    ...locationAssistance,
    candidates,
    reverseGeocodeStatus: candidates.some((candidate) => candidate.reverseGeocode?.status === "ok")
      ? "ok"
      : candidates.some((candidate) => candidate.reverseGeocode)
        ? "unavailable"
        : "not_attempted",
  };
}
