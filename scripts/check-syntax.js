import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOTS = ["src", "averoui", "test", "scripts"];
const IGNORED_DIRECTORIES = new Set(["node_modules", "coverage", "dist"]);

async function collectJavaScriptFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) {
        files.push(...await collectJavaScriptFiles(fullPath));
      }
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = (await Promise.all(ROOTS.map(collectJavaScriptFiles))).flat().sort();
if (!files.length) {
  console.error("No JavaScript files were found to syntax-check.");
  process.exitCode = 1;
} else {
  let failed = 0;
  for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
    if (result.error) {
      console.error("Could not syntax-check " + file + ":", result.error.message);
      failed += 1;
    } else if (result.status !== 0) {
      failed += 1;
    }
  }

  if (failed) {
    console.error("Syntax check failed for " + failed + " of " + files.length + " JavaScript file(s).");
    process.exitCode = 1;
  } else {
    console.log("Syntax check passed for " + files.length + " JavaScript file(s).");
  }
}
