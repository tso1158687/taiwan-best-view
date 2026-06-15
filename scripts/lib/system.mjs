import { access, stat } from "node:fs/promises";
import { spawn } from "node:child_process";

export function run(command, args) {
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

export async function commandExists(command) {
  try {
    await run("/usr/bin/which", [command]);
    return true;
  } catch {
    return false;
  }
}

export async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function fileSize(path) {
  const fileStat = await stat(path);
  return fileStat.size;
}
