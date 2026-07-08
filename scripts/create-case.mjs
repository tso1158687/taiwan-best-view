#!/usr/bin/env node
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileSize, pathExists } from "./lib/system.mjs";
import {
  ATTACHMENT_EXTENSIONS,
  IMAGE_EXTENSIONS,
  PHOTO_ANALYSIS_EXTENSIONS,
  allowedAttachmentExtensionsFor,
  isHeic,
  readSipsMetadata,
  sipsDateToTaiwanIso,
} from "./lib/metadata.mjs";
import { convertHeicOne } from "./lib/heic-conversion.mjs";
import {
  createLocationCandidates,
  createOcrLocationCandidates,
  mergeOcrLocationCandidates,
} from "./lib/location-candidates.mjs";
import { enrichLocationCandidatesWithReverseGeocode } from "./lib/reverse-geocode.mjs";
import { analyzePhotos } from "./lib/photo-analysis.mjs";
import { createFieldSuggestions } from "./lib/field-suggestions.mjs";
import {
  createConfirmedLocationCandidates,
  mergeConfirmedLocationCandidates,
  readConfirmedLocationLibrary,
} from "./lib/confirmed-locations.mjs";

const DEFAULT_DESCRIPTION = "車輛停放於違規地點，妨礙通行或影響交通安全。";

function usage() {
  console.log("Usage: node scripts/create-case.mjs <input-file-or-directory> [--jurisdiction taipei|new_taipei] [--confirmed-locations path]");
  console.log("");
  console.log("Creates a local case workspace under cases/<case-id>/ and writes draft.json.");
}

function parseArgs(argv) {
  const input = argv[2];
  const result = {
    input,
    jurisdiction: "taipei",
    confirmedLocationsPath: "",
  };

  for (let index = 3; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--jurisdiction") {
      result.jurisdiction = argv[index + 1] || result.jurisdiction;
      index += 1;
    } else if (arg === "--confirmed-locations") {
      result.confirmedLocationsPath = argv[index + 1] || "";
      index += 1;
    }
  }

  return result;
}

function caseIdFromDate(date = new Date()) {
  const value = date.toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  return `case-${value}`;
}

async function collectAttachmentInputs(inputPath) {
  const absoluteInput = resolve(inputPath);
  const extension = extname(absoluteInput).toLowerCase();
  const inputStat = await stat(absoluteInput);

  if (inputStat.isFile()) {
    return ATTACHMENT_EXTENSIONS.has(extension) ? [absoluteInput] : [];
  }

  const entries = await readdir(absoluteInput, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && ATTACHMENT_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => join(absoluteInput, entry.name));
}

function createAttachment({ originalPath, originalName, submissionPath, submissionName, size, conversion, metadata = {}, jurisdiction }) {
  const originalExtensionWithDot = extname(originalName).toLowerCase();
  const submissionExtensionWithDot = extname(submissionName).toLowerCase();
  const originalExtension = originalExtensionWithDot.replace(".", "");
  const submissionExtension = submissionExtensionWithDot.replace(".", "");
  const allowedExtensions = allowedAttachmentExtensionsFor(jurisdiction);

  return {
    originalName,
    originalPath,
    submissionName,
    submissionPath,
    originalExtension,
    submissionExtension,
    size,
    type: originalExtension,
    needsConversion: isHeic(originalName),
    conversionStatus: conversion?.conversionStatus || "not_required",
    exifStatus: conversion?.exifStatus || (metadata.creation ? "partial" : "not_checked"),
    gpsStatus: conversion?.gpsStatus || "not_checked",
    capturedAt: conversion?.capturedAt || sipsDateToTaiwanIso(metadata.creation),
    latitude: conversion?.latitude ?? null,
    longitude: conversion?.longitude ?? null,
    renderedWidth: conversion?.renderedWidth ?? null,
    renderedHeight: conversion?.renderedHeight ?? null,
    metadataEmbeddingStatus: conversion?.metadataEmbeddingStatus || "not_applicable",
    metadataEmbeddingTool: conversion?.metadataEmbeddingTool || "",
    metadataEmbeddingError: conversion?.metadataEmbeddingError || "",
    acceptedByOfficial: allowedExtensions.has(submissionExtensionWithDot),
    verificationSource: conversion?.verificationSource || (metadata.creation ? "sips" : "file_extension"),
    note: conversion?.note || "",
  };
}

async function processOne(inputPath, caseDirectory, jurisdiction) {
  const originalName = basename(inputPath);
  const originalPath = join(caseDirectory, "originals", originalName);
  const extension = extname(inputPath).toLowerCase();
  const isImage = IMAGE_EXTENSIONS.has(extension);
  const metadata = isImage ? await readSipsMetadata(inputPath) : {};
  await copyFile(inputPath, originalPath);

  if (isHeic(inputPath)) {
    const conversion = await convertHeicOne(originalPath, join(caseDirectory, "converted"));
    return createAttachment({
      originalPath,
      originalName,
      submissionPath: conversion.output,
      submissionName: basename(conversion.output),
      size: await fileSize(originalPath),
      conversion,
      metadata,
      jurisdiction,
    });
  }

  const submissionPath = join(caseDirectory, "converted", originalName);
  await copyFile(originalPath, submissionPath);
  return createAttachment({
    originalPath,
    originalName,
    submissionPath,
    submissionName: originalName,
    size: await fileSize(originalPath),
    metadata,
    jurisdiction,
  });
}

function deriveOccurredAt(attachments) {
  const dates = attachments
    .map((attachment) => attachment.capturedAt)
    .filter(Boolean)
    .sort();

  return dates[0] || "";
}

async function main() {
  const options = parseArgs(process.argv);
  if (!options.input || options.input === "--help" || options.input === "-h") {
    usage();
    return;
  }

  if (!["taipei", "new_taipei"].includes(options.jurisdiction)) {
    throw new Error("jurisdiction must be taipei or new_taipei");
  }

  if (!(await pathExists(options.input))) {
    throw new Error(`Input does not exist: ${options.input}`);
  }

  const inputs = await collectAttachmentInputs(options.input);
  if (inputs.length === 0) {
    throw new Error("No supported attachment files found.");
  }
  if (inputs.length > 5) {
    throw new Error(`A case draft can include at most 5 attachments; found ${inputs.length}.`);
  }

  const caseDirectory = join(resolve("cases"), caseIdFromDate());
  const caseId = basename(caseDirectory);
  await mkdir(join(caseDirectory, "originals"), { recursive: true });
  await mkdir(join(caseDirectory, "converted"), { recursive: true });

  const attachments = [];
  for (const input of inputs) {
    attachments.push(await processOne(input, caseDirectory, options.jurisdiction));
  }
  const photoAnalysis = await analyzePhotos(
    attachments
      .filter((attachment) => PHOTO_ANALYSIS_EXTENSIONS.has(`.${attachment.submissionExtension}`))
      .map((attachment) => attachment.submissionPath)
  );
  const gpsLocationAssistance = await enrichLocationCandidatesWithReverseGeocode(createLocationCandidates(attachments));
  const ocrLocationCandidates = createOcrLocationCandidates(photoAnalysis);
  let locationAssistance = mergeOcrLocationCandidates({
    locationAssistance: gpsLocationAssistance,
    candidates: ocrLocationCandidates,
  });

  if (options.confirmedLocationsPath) {
    const confirmedLocationLibrary = await readConfirmedLocationLibrary(options.confirmedLocationsPath);
    const confirmedLocationCandidates = createConfirmedLocationCandidates({
      library: confirmedLocationLibrary,
      jurisdiction: options.jurisdiction,
      locationAssistance,
      photoAnalysis,
    });
    locationAssistance = mergeConfirmedLocationCandidates({
      locationAssistance,
      candidates: confirmedLocationCandidates,
    });
  }

  const fieldSuggestions = createFieldSuggestions({ photoAnalysis, locationAssistance });

  const draft = {
    caseId,
    jurisdiction: options.jurisdiction,
    violationType: "illegal_parking",
    plate: "",
    occurredAt: deriveOccurredAt(attachments),
    district: "",
    road: "",
    addressNote: "",
    fact: "違規停車",
    description: DEFAULT_DESCRIPTION,
    files: attachments.map((attachment) => attachment.submissionName),
    originalFiles: attachments.map((attachment) => attachment.originalName),
    attachments,
    locationAssistance,
    photoAnalysis,
    fieldSuggestions,
    status: "draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const report = {
    caseId,
    caseDirectory,
    inputCount: inputs.length,
    submissionFiles: draft.files,
    occurredAtCandidate: draft.occurredAt,
    locationAssistance,
    confirmedLocationsPath: options.confirmedLocationsPath || "",
    confirmedLocationCandidateCount: locationAssistance.confirmedLocationCandidateCount || 0,
    fieldSuggestions,
    photoAnalysis: {
      status: photoAnalysis.status,
      engine: photoAnalysis.engine,
      plateCandidates: photoAnalysis.plateCandidates,
      locationTextCandidates: photoAnalysis.locationTextCandidates,
      resultCount: photoAnalysis.results.length,
      reason: photoAnalysis.reason,
    },
    reverseGeocodeStatus: locationAssistance.reverseGeocodeStatus,
    attachments: attachments.map((attachment) => ({
      originalName: attachment.originalName,
      submissionName: attachment.submissionName,
      conversionStatus: attachment.conversionStatus,
      exifStatus: attachment.exifStatus,
      gpsStatus: attachment.gpsStatus,
      capturedAt: attachment.capturedAt,
      hasGps: typeof attachment.latitude === "number" && typeof attachment.longitude === "number",
      renderedWidth: attachment.renderedWidth,
      renderedHeight: attachment.renderedHeight,
      metadataEmbeddingStatus: attachment.metadataEmbeddingStatus,
      metadataEmbeddingTool: attachment.metadataEmbeddingTool,
      acceptedByOfficial: attachment.acceptedByOfficial,
      verificationSource: attachment.verificationSource,
      note: attachment.note,
    })),
  };

  await writeFile(join(caseDirectory, "draft.json"), `${JSON.stringify(draft, null, 2)}\n`);
  await writeFile(join(caseDirectory, "processing-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
