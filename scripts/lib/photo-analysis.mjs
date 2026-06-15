import { basename } from "node:path";
import { commandExists, run } from "./system.mjs";

const PLATE_PATTERN = /\b[A-Z0-9]{2,4}[-\s]?[A-Z0-9]{1,4}\b/g;
const LOCATION_KEYWORDS = [
  "路",
  "街",
  "巷",
  "弄",
  "號",
  "區",
  "橋",
  "站",
  "牛排",
  "診所",
  "便利",
  "停車",
  "門市",
];

function normalizePlate(value) {
  return value.replace(/\s+/g, "").toUpperCase();
}

function collectPlateCandidates(items) {
  const candidates = new Map();

  for (const item of items) {
    const text = item.text.toUpperCase();
    const matches = text.match(PLATE_PATTERN) || [];
    for (const match of matches) {
      const normalized = normalizePlate(match);
      if (normalized.length < 5 || normalized.length > 8) continue;
      const previous = candidates.get(normalized);
      if (!previous || item.confidence > previous.confidence) {
        candidates.set(normalized, {
          text: normalized,
          confidence: item.confidence,
          sourceText: item.text,
        });
      }
    }
  }

  return [...candidates.values()].sort((a, b) => b.confidence - a.confidence);
}

function collectLocationTextCandidates(items) {
  return items
    .filter((item) => LOCATION_KEYWORDS.some((keyword) => item.text.includes(keyword)))
    .map((item) => ({
      text: item.text,
      confidence: item.confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

export async function analyzePhotos(imagePaths) {
  if (!(await commandExists("swift"))) {
    return {
      status: "unavailable",
      engine: "apple_vision",
      reason: "swift is not available",
      results: [],
      plateCandidates: [],
      locationTextCandidates: [],
    };
  }

  try {
    const { stdout } = await run("swift", ["scripts/ocr-vision.swift", ...imagePaths]);
    const results = JSON.parse(stdout).map((result) => ({
      ...result,
      fileName: basename(result.file),
    }));
    const allItems = results.flatMap((result) => result.items || []);

    return {
      status: "ok",
      engine: "apple_vision",
      results,
      plateCandidates: collectPlateCandidates(allItems),
      locationTextCandidates: collectLocationTextCandidates(allItems),
    };
  } catch (error) {
    return {
      status: "failed",
      engine: "apple_vision",
      reason: error.message,
      results: [],
      plateCandidates: [],
      locationTextCandidates: [],
    };
  }
}
