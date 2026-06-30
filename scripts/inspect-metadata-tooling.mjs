#!/usr/bin/env node
import { metadataToolingStatus } from "./lib/heic-conversion.mjs";

async function main() {
  const tooling = await metadataToolingStatus();
  console.log(JSON.stringify({
    status: tooling.qlmanage ? "ready" : "missing_required_tool",
    qlmanage: tooling.qlmanage,
    exiftool: tooling.exiftool,
    conversionMode: tooling.exiftool ? "quicklook_png_with_exiftool_embedding" : "quicklook_png_with_sidecar_metadata",
    notes: tooling.exiftool
      ? [
          "QuickLook renders HEIC/HEIF to PNG.",
          "exiftool is available and will be used to embed/copy metadata when conversion runs.",
        ]
      : [
          "QuickLook renders HEIC/HEIF to PNG.",
          "exiftool is not available, so original metadata remains in draft sidecar data.",
        ],
  }, null, 2));

  if (!tooling.qlmanage) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
