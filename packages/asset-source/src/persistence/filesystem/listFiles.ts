// Import Node.js Dependencies
import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import { toRelativePosix } from "../../paths.ts";
import type { AssetPathMatcher } from "./ignoredPaths.ts";

export async function listFiles(
  root: string,
  isIgnored: AssetPathMatcher
): Promise<string[]> {
  const entries: string[] = [];
  await walk(
    root,
    root,
    isIgnored,
    entries
  );

  return entries.sort();
}

async function walk(
  root: string,
  directory: string,
  isIgnored: AssetPathMatcher,
  entries: string[]
): Promise<void> {
  let children: Dirent[];
  try {
    children = await fs.readdir(
      directory,
      { withFileTypes: true }
    );
  }
  catch (error) {
    if (
      isNotFound(error) &&
      directory === root
    ) {
      return;
    }
    throw error;
  }

  for (const child of children) {
    const absolute = path.join(directory, child.name);
    const relative = toRelativePosix(
      root,
      absolute
    );
    if (
      relative === null ||
      isIgnored(relative)
    ) {
      continue;
    }

    if (child.isDirectory()) {
      await walk(
        root,
        absolute,
        isIgnored,
        entries
      );
    }
    else if (
      child.isFile() &&
      !isTemporary(child.name)
    ) {
      entries.push(relative);
    }
  }
}

function isNotFound(
  error: unknown
): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT";
}

function isTemporary(
  name: string
): boolean {
  return name.startsWith(".") && name.endsWith(".tmp");
}
