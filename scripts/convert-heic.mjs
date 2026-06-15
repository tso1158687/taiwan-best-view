#!/usr/bin/env node
import { access, mkdir, readdir } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

function usage() {
  console.log("Usage: node scripts/convert-heic.mjs <input-file-or-directory> [output-directory]");
  console.log("");
  console.log("Converts HEIC/HEIF files to JPG using macOS sips.");
  console.log("If exiftool is installed, metadata is copied and DateTime/GPS fields are verified.");
}

function run(command, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      rejectPromise(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
    });
  });
}

async function commandExists(command) {
  try {
    await run("/usr/bin/which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function collectInputs(inputPath) {
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

function outputPathFor(inputPath, outputDirectory) {
  const base = basename(inputPath, extname(inputPath));
  const directory = outputDirectory ? resolve(outputDirectory) : dirname(inputPath);
  return join(directory, `${base}.jpg`);
}

async function copyMetadata(inputPath, outputPath) {
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

async function verifyMetadata(outputPath) {
  const { stdout } = await run("exiftool", [
    "-j",
    "-DateTimeOriginal",
    "-CreateDate",
    "-GPSLatitude",
    "-GPSLongitude",
    outputPath,
  ]);
  const [metadata] = JSON.parse(stdout);
  const hasDate = Boolean(metadata.DateTimeOriginal || metadata.CreateDate);
  const hasGps = Boolean(metadata.GPSLatitude && metadata.GPSLongitude);

  if (hasDate && hasGps) return "preserved";
  if (hasDate || hasGps) return "partial";
  return "missing";
}

async function convertOne(inputPath, outputDirectory, hasExiftool) {
  const outputPath = outputPathFor(inputPath, outputDirectory);
  await mkdir(dirname(outputPath), { recursive: true });
  await run("sips", ["-s", "format", "jpeg", inputPath, "--out", outputPath]);

  if (!hasExiftool) {
    return {
      input: inputPath,
      output: outputPath,
      conversionStatus: "converted",
      exifStatus: "not_checked",
      note: "Install exiftool to copy and verify EXIF metadata.",
    };
  }

  await copyMetadata(inputPath, outputPath);
  const exifStatus = await verifyMetadata(outputPath);
  return {
    input: inputPath,
    output: outputPath,
    conversionStatus: "converted",
    exifStatus,
  };
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || inputArg === "--help" || inputArg === "-h") {
    usage();
    return;
  }

  if (!(await pathExists(inputArg))) {
    throw new Error(`Input does not exist: ${inputArg}`);
  }

  if (!(await commandExists("sips"))) {
    throw new Error("macOS sips is required for HEIC conversion.");
  }

  const hasExiftool = await commandExists("exiftool");
  const inputs = await collectInputs(inputArg);
  if (inputs.length === 0) {
    console.log("No HEIC/HEIF files found.");
    return;
  }

  const results = [];
  for (const input of inputs) {
    results.push(await convertOne(input, outputArg, hasExiftool));
  }

  console.log(JSON.stringify({ hasExiftool, results }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
