import { mkdir, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { commandExists, pathExists, run } from "./system.mjs";
import { HEIC_EXTENSIONS, verifyConvertedMetadata } from "./metadata.mjs";

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
  return join(directory, `${base}.jpg`);
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
  if (!(await commandExists("sips"))) {
    throw new Error("macOS sips is required for HEIC conversion.");
  }

  const hasExiftool =
    typeof options.hasExiftool === "boolean" ? options.hasExiftool : await commandExists("exiftool");
  const outputPath = outputPathFor(inputPath, outputDirectory);
  await mkdir(dirname(outputPath), { recursive: true });
  await run("sips", ["-s", "format", "jpeg", inputPath, "--out", outputPath]);

  if (hasExiftool) {
    await copyMetadata(inputPath, outputPath);
  }

  if (!(await pathExists(outputPath))) {
    throw new Error(`Conversion reported success but output is missing: ${outputPath}`);
  }

  const metadata = await verifyConvertedMetadata(inputPath, outputPath);
  return {
    input: inputPath,
    output: outputPath,
    conversionStatus: "converted",
    exifStatus: metadata.exifStatus,
    capturedAt: metadata.capturedAt,
    gpsStatus: metadata.gpsStatus,
    latitude: metadata.latitude ?? null,
    longitude: metadata.longitude ?? null,
    verificationSource: metadata.source,
    note: metadata.note,
  };
}
