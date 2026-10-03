// Import Node.js Dependencies
import fs from "node:fs/promises";
import type { Dir } from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import { toRelativePosix } from "./toRelativePosix.ts";
import type { AssetPathMatcher } from "./ignoredPaths.ts";

export interface WalkOptions {
  isIgnored: AssetPathMatcher;
  isTemporary: (name: string) => boolean;
}

interface WalkEntry {
  path: string;
  folder: boolean;
}

export async function* walk(
  root: string,
  options: WalkOptions
): AsyncIterableIterator<string> {
  for await (const entry of walkEntries(root, options)) {
    if (!entry.folder) {
      yield entry.path;
    }
  }
}

export async function* walkFolders(
  root: string,
  options: WalkOptions
): AsyncIterableIterator<string> {
  for await (const entry of walkEntries(root, options)) {
    if (entry.folder) {
      yield entry.path;
    }
  }
}

async function* walkEntries(
  root: string,
  options: WalkOptions
): AsyncIterableIterator<WalkEntry> {
  const directory = await openRoot(root);
  if (directory === null) {
    return;
  }

  yield* walkDirectory(
    root,
    directory,
    options
  );
}

async function* walkDirectory(
  root: string,
  directory: Dir,
  options: WalkOptions
): AsyncIterableIterator<WalkEntry> {
  for await (const dirent of directory) {
    const absolute = path.join(directory.path, dirent.name);
    const relative = toRelativePosix(
      root,
      absolute
    );
    if (
      relative === null ||
      options.isIgnored(relative)
    ) {
      continue;
    }

    if (dirent.isDirectory()) {
      yield {
        path: relative,
        folder: true
      };
      yield* walkDirectory(
        root,
        await fs.opendir(absolute),
        options
      );
    }
    else if (
      dirent.isFile() &&
      !options.isTemporary(dirent.name)
    ) {
      yield {
        path: relative,
        folder: false
      };
    }
  }
}

async function openRoot(
  root: string
): Promise<Dir | null> {
  try {
    return await fs.opendir(root);
  }
  catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
