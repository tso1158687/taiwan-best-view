import { extname } from "node:path";
import { commandExists, run } from "./system.mjs";

export const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);
export const IMAGE_EXTENSIONS = new Set([".heic", ".heif", ".jpg", ".jpeg", ".png", ".bmp", ".tiff"]);

export function isHeic(path) {
  return HEIC_EXTENSIONS.has(extname(path).toLowerCase());
}

export function parseSipsProperties(stdout) {
  const properties = {};

  for (const line of stdout.split("\n")) {
    const match = line.match(/^\s{2}([^:]+):\s*(.*)$/);
    if (!match) continue;
    properties[match[1].trim()] = match[2].trim();
  }

  return properties;
}

export async function readSipsMetadata(path) {
  const { stdout } = await run("sips", ["-g", "all", path]);
  return parseSipsProperties(stdout);
}

export async function inspectFile(path) {
  const { stdout } = await run("file", [path]);
  return stdout.trim();
}

export function parseFileExifDate(fileOutput) {
  const match = fileOutput.match(/datetime=([0-9]{4}:[0-9]{2}:[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2})/);
  return match ? match[1] : "";
}

export function sipsDateToTaiwanIso(value) {
  if (!value) return "";
  const match = value.match(/^([0-9]{4}):([0-9]{2}):([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})$/);
  if (!match) return "";
  const [, year, month, day, hour, minute, second] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+08:00`;
}

export async function verifyWithExiftool(path) {
  const { stdout } = await run("exiftool", [
    "-j",
    "-DateTimeOriginal",
    "-CreateDate",
    "-GPSLatitude",
    "-GPSLongitude",
    path,
  ]);
  const [metadata] = JSON.parse(stdout);
  const capturedAt = metadata.DateTimeOriginal || metadata.CreateDate || "";
  const hasDate = Boolean(capturedAt);
  const hasGps = Boolean(metadata.GPSLatitude && metadata.GPSLongitude);

  return {
    capturedAt,
    hasDate,
    hasGps,
    exifStatus: hasDate && hasGps ? "preserved" : hasDate ? "partial" : "missing",
    gpsStatus: hasGps ? "present" : "missing",
    source: "exiftool",
  };
}

export async function verifyConvertedMetadata(inputPath, outputPath) {
  if (await commandExists("exiftool")) {
    return verifyWithExiftool(outputPath);
  }

  const inputSips = await readSipsMetadata(inputPath);
  const outputFile = await inspectFile(outputPath);
  const outputDate = parseFileExifDate(outputFile);
  const inputDate = inputSips.creation || "";
  const hasPreservedDate = Boolean(inputDate && outputDate && inputDate === outputDate);
  const hasAnyDate = Boolean(outputDate);

  return {
    capturedAt: sipsDateToTaiwanIso(outputDate || inputDate),
    hasDate: hasAnyDate,
    hasGps: false,
    exifStatus: hasPreservedDate ? "partial" : hasAnyDate ? "partial" : "missing",
    gpsStatus: "not_checked",
    source: "sips+file",
    note: hasPreservedDate
      ? "Date metadata was preserved; GPS requires exiftool or a deeper EXIF parser."
      : "Install exiftool to copy and verify full EXIF metadata.",
  };
}
