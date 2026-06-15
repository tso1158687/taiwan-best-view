import { copyFile, mkdir, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { commandExists, fileSize, pathExists, run } from "./system.mjs";
import { HEIC_EXTENSIONS, readSipsMetadata, sipsDateToTaiwanIso, verifyConvertedMetadata } from "./metadata.mjs";

const DEFAULT_MAX_PIXEL_SIZE = "2048";

export async function collectHeicInputs(inputPath) {
  const absoluteInput = resolve(inputPath);
  const extension = extname(absoluteInput).toLowerCase();

  if (HEIC_EXTENSIONS.has(extension)) {
    return [absoluteInput];
  }

  const entries = await readdir(absoluteInput, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && HEIC_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => join(absoluteInput, entry.name));
}

export function outputPathFor(inputPath, outputDirectory) {
  const base = basename(inputPath, extname(inputPath));
  const directory = outputDirectory ? resolve(outputDirectory) : dirname(inputPath);
  return join(directory, `${base}.png`);
}

export async function copyMetadata(inputPath, outputPath) {
  await run("exiftool", [
    "-TagsFromFile",
    inputPath,
    "-all:all",
    "-unsafe",
    "-icc_profile",
    "-overwrite_original",
    outputPath,
  ]);
}

export async function convertHeicOne(inputPath, outputDirectory, options = {}) {
  if (!(await commandExists("qlmanage"))) {
    throw new Error("macOS qlmanage is required for HEIC image rendering.");
  }

  const hasExiftool =
    typeof options.hasExiftool === "boolean" ? options.hasExiftool : await commandExists("exiftool");
  const outputPath = outputPathFor(inputPath, outputDirectory);
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryDirectory = join(dirname(outputPath), ".quicklook");
  await mkdir(temporaryDirectory, { recursive: true });
  await run("qlmanage", ["-t", "-s", options.maxPixelSize || DEFAULT_MAX_PIXEL_SIZE, "-o", temporaryDirectory, inputPath]);

  const quickLookOutput = join(temporaryDirectory, `${basename(inputPath)}.png`);
  if (!(await pathExists(quickLookOutput))) {
    throw new Error(`QuickLook did not create expected preview: ${quickLookOutput}`);
  }

  await copyFile(quickLookOutput, outputPath);
  const renderedSize = await fileSize(outputPath);
  if (renderedSize < 100000) {
    throw new Error(`Rendered image is unexpectedly small: ${outputPath}`);
  }
  const renderedMetadata = await readSipsMetadata(outputPath);
  const renderedWidth = Number(renderedMetadata.pixelWidth || 0);
  const renderedHeight = Number(renderedMetadata.pixelHeight || 0);
  if (!renderedWidth || !renderedHeight) {
    throw new Error(`Rendered image has no readable dimensions: ${outputPath}`);
  }

  if (hasExiftool) {
    await copyMetadata(inputPath, outputPath);
  }

  if (!(await pathExists(outputPath))) {
    throw new Error(`Conversion reported success but output is missing: ${outputPath}`);
  }

  const metadata = hasExiftool
    ? await verifyConvertedMetadata(inputPath, outputPath)
    : await verifyConvertedMetadata(inputPath, outputPath, { sidecarOnly: true });
  const originalMetadata = await readSipsMetadata(inputPath);
  const fallbackCapturedAt = sipsDateToTaiwanIso(originalMetadata.creation);

  return {
    input: inputPath,
    output: outputPath,
    conversionStatus: "converted",
    exifStatus: metadata.exifStatus || "sidecar",
    capturedAt: metadata.capturedAt || fallbackCapturedAt,
    gpsStatus: metadata.gpsStatus,
    latitude: metadata.latitude ?? null,
    longitude: metadata.longitude ?? null,
    verificationSource: metadata.source,
    renderedSize,
    renderedWidth,
    renderedHeight,
    note: metadata.note,
  };
}
