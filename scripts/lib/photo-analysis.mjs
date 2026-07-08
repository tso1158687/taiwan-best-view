import { basename } from "node:path";
import { commandExists, run } from "./system.mjs";
import { findPlateCandidatesFromText } from "./plate-normalization.mjs";

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

function collectPlateCandidates(items) {
  const candidates = new Map();

  for (const item of items) {
    for (const candidate of findPlateCandidatesFromText(item.text, item.confidence)) {
      const previous = candidates.get(candidate.text);
      if (!previous || candidate.confidence > previous.confidence) {
        candidates.set(candidate.text, candidate);
      }
    }
  }

  return [...candidates.values()].sort((a, b) => b.confidence - a.confidence);
}

function collectLocationTextCandidates(results) {
  return results
    .flatMap((result) => (result.items || []).map((item) => ({
      text: item.text,
      confidence: item.confidence,
      fileName: result.fileName,
    })))
    .filter((item) => LOCATION_KEYWORDS.some((keyword) => item.text.includes(keyword)))
    .sort((a, b) => b.confidence - a.confidence);
}

export async function analyzePhotos(imagePaths) {
  if (imagePaths.length === 0) {
    return {
      status: "skipped",
      engine: "apple_vision",
      reason: "no image attachments",
      results: [],
      plateCandidates: [],
      locationTextCandidates: [],
    };
  }

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
      locationTextCandidates: collectLocationTextCandidates(results),
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
