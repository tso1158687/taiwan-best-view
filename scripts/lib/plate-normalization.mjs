const PLATE_TEXT_PATTERN = /[A-Z0-9０-９Ａ-Ｚ]{2,4}[-\s－–—]?[A-Z0-9０-９Ａ-Ｚ]{1,4}/gi;
const DIGIT_HINTS = new Map([
  ["O", "0"],
  ["Q", "0"],
  ["I", "1"],
  ["L", "1"],
  ["Z", "2"],
  ["S", "5"],
  ["B", "8"],
]);
const LETTER_HINTS = new Map([
  ["0", "O"],
  ["1", "I"],
  ["2", "Z"],
  ["5", "S"],
  ["8", "B"],
]);

function clamp(value) {
  return Math.max(0.01, Math.min(0.99, value));
}

function roundConfidence(value) {
  return Math.round(clamp(value) * 1000) / 1000;
}

function toHalfWidth(value) {
  return String(value || "").replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}

function cleanPart(value) {
  return toHalfWidth(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function convertForTemplate(value, template) {
  if (value.length !== template.length) return null;

  let converted = "";
  const corrections = [];

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const slot = template[index];
    if (slot === "D") {
      if (/[0-9]/.test(char)) {
        converted += char;
      } else if (DIGIT_HINTS.has(char)) {
        const next = DIGIT_HINTS.get(char);
        converted += next;
        corrections.push(`${char}->${next}`);
      } else {
        return null;
      }
    } else if (slot === "L") {
      if (/[A-Z]/.test(char)) {
        converted += char;
      } else if (LETTER_HINTS.has(char)) {
        const next = LETTER_HINTS.get(char);
        converted += next;
        corrections.push(`${char}->${next}`);
      } else {
        return null;
      }
    }
  }

  return {
    value: converted,
    corrections,
  };
}

function plateFromTemplate(compact, template, splitAt, pattern) {
  const converted = convertForTemplate(compact, template);
  if (!converted) return null;

  const prefix = converted.value.slice(0, splitAt);
  const suffix = converted.value.slice(splitAt);
  return {
    prefix,
    suffix,
    text: `${prefix}-${suffix}`,
    normalizedText: converted.value,
    pattern,
    corrections: converted.corrections,
  };
}

function inferPlate(compact, originalHasSeparator) {
  const candidates = [
    plateFromTemplate(compact, "DDDDL", 4, "four_digits_one_letter_incomplete"),
    plateFromTemplate(compact, "DDDDLL", 4, "four_digits_two_letters"),
    plateFromTemplate(compact, "DDDDLLL", 4, "four_digits_three_letters"),
    plateFromTemplate(compact, "LLDDDD", 2, "two_letters_four_digits"),
    plateFromTemplate(compact, "LLLDDDD", 3, "three_letters_four_digits"),
  ].filter(Boolean);

  if (candidates.length > 0) {
    return candidates
      .map((candidate) => ({
        ...candidate,
        confidenceBonus: candidate.pattern.includes("incomplete")
          ? (originalHasSeparator ? -0.08 : -0.12)
          : (originalHasSeparator ? 0.1 : 0.08),
        confidenceReasons: [
          `matches ${candidate.pattern}`,
          candidate.pattern.includes("incomplete") ? "incomplete candidate requires extra review" : "complete plate-length candidate",
          originalHasSeparator ? "separator observed" : "separator inferred",
          ...candidate.corrections.map((item) => `OCR correction ${item}`),
        ],
      }))
      .sort((a, b) => a.corrections.length - b.corrections.length)[0];
  }

  if (originalHasSeparator && compact.length >= 5 && compact.length <= 8) {
    return {
      prefix: "",
      suffix: compact,
      text: compact,
      normalizedText: compact,
      pattern: "separator_unclassified",
      corrections: [],
      confidenceBonus: -0.02,
      confidenceReasons: ["separator observed", "unclassified plate shape"],
    };
  }

  return null;
}

export function normalizePlateCandidate(value, ocrConfidence = 0.5) {
  const original = String(value || "");
  const hasSeparator = /[-\s－–—]/.test(original.trim());
  const compact = cleanPart(original);
  if (compact.length < 5 || compact.length > 8) return null;

  const inferred = inferPlate(compact, hasSeparator);
  if (!inferred) return null;

  const correctionPenalty = inferred.corrections.length * 0.05;
  const confidence = roundConfidence(Number(ocrConfidence || 0) + inferred.confidenceBonus - correctionPenalty);

  return {
    text: inferred.text,
    normalizedText: inferred.normalizedText,
    prefix: inferred.prefix,
    suffix: inferred.suffix,
    pattern: inferred.pattern,
    confidence,
    confidenceReasons: inferred.confidenceReasons,
    rawText: original.trim(),
    requiresReview: true,
  };
}

export function findPlateCandidatesFromText(text, ocrConfidence = 0.5) {
  const matches = toHalfWidth(text).toUpperCase().match(PLATE_TEXT_PATTERN) || [];
  const byText = new Map();

  for (const match of matches) {
    const candidate = normalizePlateCandidate(match, ocrConfidence);
    if (!candidate) continue;
    const previous = byText.get(candidate.text);
    if (!previous || candidate.confidence > previous.confidence) {
      byText.set(candidate.text, {
        ...candidate,
        sourceText: text,
      });
    }
  }

  return [...byText.values()].sort((a, b) => b.confidence - a.confidence);
}

export function splitPlateForForm(value) {
  const candidate = normalizePlateCandidate(value, 0.5);
  if (candidate?.prefix && candidate?.suffix) {
    return {
      raw: candidate.text,
      prefix: candidate.prefix,
      suffix: candidate.suffix,
    };
  }

  const normalized = cleanPart(value);
  const [prefix, suffix] = String(value || "").trim().toUpperCase().split("-");
  return {
    raw: candidate?.text || normalized,
    prefix: suffix ? cleanPart(prefix) : "",
    suffix: suffix ? cleanPart(suffix) : normalized,
  };
}
