#!/usr/bin/env node
import { findPlateCandidatesFromText, normalizePlateCandidate, splitPlateForForm } from "./lib/plate-normalization.mjs";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstCandidate(text, confidence = 0.8) {
  const [candidate] = findPlateCandidatesFromText(text, confidence);
  return candidate;
}

async function main() {
  const numericPrefix = firstCandidate("3999YG", 0.82);
  assert(numericPrefix.text === "3999-YG", "Expected 3999YG to normalize to 3999-YG.");
  assert(numericPrefix.pattern === "four_digits_two_letters", "Expected four digit/two letter plate pattern.");
  assert(numericPrefix.confidenceReasons.includes("separator inferred"), "Expected inferred separator reason.");

  const letterPrefix = firstCandidate("ABC1234", 0.77);
  assert(letterPrefix.text === "ABC-1234", "Expected ABC1234 to normalize to ABC-1234.");
  assert(letterPrefix.pattern === "three_letters_four_digits", "Expected three letter/four digit plate pattern.");

  const corrected = firstCandidate("3999Y8", 0.7);
  assert(corrected.text === "3999-YB", "Expected OCR 8 in letter slot to be corrected to B.");
  assert(corrected.confidenceReasons.some((reason) => reason.includes("OCR correction 8->B")), "Expected correction reason.");

  const split = splitPlateForForm("3999YG");
  assert(split.prefix === "3999", "Expected normalized plate prefix for official form.");
  assert(split.suffix === "YG", "Expected normalized plate suffix for official form.");

  assert(normalizePlateCandidate("12", 0.9) === null, "Expected too-short text to be rejected.");

  const mixedCandidates = [
    ...findPlateCandidatesFromText("3999-B", 0.96),
    ...findPlateCandidatesFromText("3999YG", 0.82),
  ].sort((a, b) => b.confidence - a.confidence);
  assert(mixedCandidates[0].text === "3999-YG", "Expected complete plate candidate to outrank incomplete OCR fragment.");

  console.log(JSON.stringify({
    ok: true,
    verified: ["plate normalization", "OCR correction reasons", "official form split"],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
