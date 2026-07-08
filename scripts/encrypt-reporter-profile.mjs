#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  encryptReporterProfile,
  isEncryptedReporterProfile,
  summarizeReporterProfile,
} from "./lib/reporter-profile.mjs";
import { pathExists } from "./lib/system.mjs";

function usage() {
  console.log("Usage: node scripts/encrypt-reporter-profile.mjs <plain-profile.json> <encrypted-output.json>");
  console.log("");
  console.log("Encrypts a local reporter profile with REPORTER_PROFILE_PASSPHRASE.");
  console.log("The command never prints personal data values and refuses to overwrite output files.");
}

async function main() {
  const [, , inputArg, outputArg] = process.argv;
  if (!inputArg || !outputArg || inputArg === "--help" || inputArg === "-h") {
    usage();
    return;
  }

  const passphrase = process.env.REPORTER_PROFILE_PASSPHRASE;
  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  if (await pathExists(outputPath)) {
    throw new Error(`Refusing to overwrite existing encrypted reporter profile: ${outputPath}`);
  }

  const profile = JSON.parse(await readFile(inputPath, "utf8"));
  if (isEncryptedReporterProfile(profile)) {
    throw new Error("Input already looks like an encrypted reporter profile.");
  }

  const encrypted = await encryptReporterProfile(profile, passphrase);
  const summary = summarizeReporterProfile(profile);
  await writeFile(outputPath, `${JSON.stringify(encrypted, null, 2)}\n`, { mode: 0o600 });

  console.log(JSON.stringify({
    outputPath,
    status: "encrypted",
    profileStatus: summary.status,
    missing: summary.missing,
    invalid: summary.invalid,
    encryption: {
      algorithm: encrypted.algorithm,
      kdf: encrypted.kdf,
    },
    nextStep: "Use this encrypted file anywhere a reporter profile path is accepted, with REPORTER_PROFILE_PASSPHRASE set.",
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
