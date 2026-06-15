import { extname } from "node:path";
import { readFile } from "node:fs/promises";
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

function readUInt16(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt16LE(offset) : buffer.readUInt16BE(offset);
}

function readUInt32(buffer, offset, littleEndian) {
  return littleEndian ? buffer.readUInt32LE(offset) : buffer.readUInt32BE(offset);
}

function readRational(buffer, tiffStart, valueOffset, littleEndian) {
  const numerator = readUInt32(buffer, tiffStart + valueOffset, littleEndian);
  const denominator = readUInt32(buffer, tiffStart + valueOffset + 4, littleEndian);
  return denominator === 0 ? 0 : numerator / denominator;
}

function readAscii(buffer, tiffStart, count, valueOffset, inlineOffset) {
  const start = count <= 4 ? inlineOffset : tiffStart + valueOffset;
  return buffer.toString("ascii", start, start + count).replace(/\0+$/, "");
}

function parseIfd(buffer, tiffStart, ifdOffset, littleEndian) {
  if (!ifdOffset) return new Map();

  const entries = new Map();
  const absoluteOffset = tiffStart + ifdOffset;
  if (absoluteOffset + 2 > buffer.length) return entries;

  const entryCount = readUInt16(buffer, absoluteOffset, littleEndian);
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = absoluteOffset + 2 + index * 12;
    if (entryOffset + 12 > buffer.length) break;

    const tag = readUInt16(buffer, entryOffset, littleEndian);
    const type = readUInt16(buffer, entryOffset + 2, littleEndian);
    const count = readUInt32(buffer, entryOffset + 4, littleEndian);
    const valueOffset = readUInt32(buffer, entryOffset + 8, littleEndian);

    entries.set(tag, {
      tag,
      type,
      count,
      valueOffset,
      inlineOffset: entryOffset + 8,
    });
  }

  return entries;
}

function readIfdAscii(buffer, tiffStart, entry) {
  if (!entry) return "";
  return readAscii(buffer, tiffStart, entry.count, entry.valueOffset, entry.inlineOffset);
}

function readGpsCoordinate(buffer, tiffStart, entries, coordinateTag, referenceTag, littleEndian) {
  const coordinate = entries.get(coordinateTag);
  const reference = readIfdAscii(buffer, tiffStart, entries.get(referenceTag));
  if (!coordinate || coordinate.type !== 5 || coordinate.count < 3) return null;

  const degrees = readRational(buffer, tiffStart, coordinate.valueOffset, littleEndian);
  const minutes = readRational(buffer, tiffStart, coordinate.valueOffset + 8, littleEndian);
  const seconds = readRational(buffer, tiffStart, coordinate.valueOffset + 16, littleEndian);
  const sign = reference === "S" || reference === "W" ? -1 : 1;

  return sign * (degrees + minutes / 60 + seconds / 3600);
}

function findExifPayload(buffer) {
  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) break;

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (marker === 0xe1) {
      const start = offset + 4;
      const end = offset + 2 + segmentLength;
      const header = buffer.toString("ascii", start, start + 6);
      if (header === "Exif\0\0") {
        return {
          start: start + 6,
          end,
        };
      }
    }

    offset += 2 + segmentLength;
  }

  return null;
}

export async function readJpegExif(path) {
  const buffer = await readFile(path);
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return {
      capturedAt: "",
      latitude: null,
      longitude: null,
      hasDate: false,
      hasGps: false,
    };
  }

  const payload = findExifPayload(buffer);
  if (!payload) {
    return {
      capturedAt: "",
      latitude: null,
      longitude: null,
      hasDate: false,
      hasGps: false,
    };
  }

  const tiffStart = payload.start;
  const byteOrder = buffer.toString("ascii", tiffStart, tiffStart + 2);
  const littleEndian = byteOrder === "II";
  if (!littleEndian && byteOrder !== "MM") {
    return {
      capturedAt: "",
      latitude: null,
      longitude: null,
      hasDate: false,
      hasGps: false,
    };
  }

  const firstIfdOffset = readUInt32(buffer, tiffStart + 4, littleEndian);
  const ifd0 = parseIfd(buffer, tiffStart, firstIfdOffset, littleEndian);
  const exifIfdOffset = ifd0.get(0x8769)?.valueOffset || 0;
  const gpsIfdOffset = ifd0.get(0x8825)?.valueOffset || 0;
  const exifIfd = parseIfd(buffer, tiffStart, exifIfdOffset, littleEndian);
  const gpsIfd = parseIfd(buffer, tiffStart, gpsIfdOffset, littleEndian);

  const rawDate =
    readIfdAscii(buffer, tiffStart, exifIfd.get(0x9003))
    || readIfdAscii(buffer, tiffStart, ifd0.get(0x0132));
  const latitude = readGpsCoordinate(buffer, tiffStart, gpsIfd, 0x0002, 0x0001, littleEndian);
  const longitude = readGpsCoordinate(buffer, tiffStart, gpsIfd, 0x0004, 0x0003, littleEndian);

  return {
    capturedAt: sipsDateToTaiwanIso(rawDate),
    latitude,
    longitude,
    hasDate: Boolean(rawDate),
    hasGps: typeof latitude === "number" && typeof longitude === "number",
  };
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
  const outputExif = await readJpegExif(outputPath);
  const outputFile = await inspectFile(outputPath);
  const outputDate = outputExif.capturedAt ? outputExif.capturedAt.replace(/-/g, ":").replace("T", " ").replace("+08:00", "") : parseFileExifDate(outputFile);
  const inputDate = inputSips.creation || "";
  const hasPreservedDate = Boolean(inputDate && outputDate && inputDate === outputDate);
  const hasAnyDate = Boolean(outputDate);
  const hasGps = outputExif.hasGps;

  return {
    capturedAt: outputExif.capturedAt || sipsDateToTaiwanIso(outputDate || inputDate),
    latitude: outputExif.latitude,
    longitude: outputExif.longitude,
    hasDate: hasAnyDate,
    hasGps,
    exifStatus: hasPreservedDate && hasGps ? "preserved" : hasAnyDate ? "partial" : "missing",
    gpsStatus: hasGps ? "present" : "missing",
    source: "jpeg-exif",
    note: hasPreservedDate && hasGps
      ? "Date and GPS metadata were preserved in the converted JPG."
      : hasPreservedDate
        ? "Date metadata was preserved; GPS was not found in the converted JPG."
      : "Install exiftool to copy and verify full EXIF metadata.",
  };
}
