/* eslint-disable no-param-reassign */
// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import { walk } from "@nodesecure/fs-walk";

// CONSTANTS
const kMaxSearchResults = 50;

export interface SearchMatch {
  file: string;
  line: number;
  content: string;
}

export async function collectFiles(
  dir: string,
  extension: string
): Promise<string[]> {
  const results: string[] = [];

  for await (const [dirent, absoluteFileLocation] of walk(dir, { extensions: new Set([extension]) })) {
    if (dirent.isFile()) {
      results.push(path.relative(dir, absoluteFileLocation));
    }
  }

  return results;
}

export interface SearchFilesOptions {
  dir: string;
  extension: string;
  pattern: string;
  isRegex?: boolean;
}

export async function searchFiles(
  options: SearchFilesOptions
): Promise<SearchMatch[]> {
  const { dir, extension, pattern, isRegex = false } = options;
  const files = await collectFiles(dir, extension);
  const regex = isRegex ? new RegExp(pattern, "gi") : null;
  const lowerPattern = pattern.toLowerCase();
  const results: SearchMatch[] = [];

  for (const file of files) {
    const matches = await searchInFile({
      fullPath: path.join(dir, file),
      relativePath: file,
      regex,
      lowerPattern
    });
    results.push(...matches);

    if (results.length >= kMaxSearchResults) {
      return results.slice(0, kMaxSearchResults);
    }
  }

  return results;
}

interface SearchInFileOptions {
  fullPath: string;
  relativePath: string;
  regex: RegExp | null;
  lowerPattern: string;
}

async function searchInFile(
  options: SearchInFileOptions
): Promise<SearchMatch[]> {
  const { fullPath, relativePath, regex, lowerPattern } = options;
  const results: SearchMatch[] = [];
  const handle = await fs.open(fullPath, "r");

  try {
    let lineNumber = 0;
    for await (const line of handle.readLines({ encoding: "utf-8" })) {
      lineNumber++;

      const isMatch = regex
        ? regex.test(line)
        : line.toLowerCase().includes(lowerPattern);

      // Reset regex lastIndex for the next line
      if (regex) {
        regex.lastIndex = 0;
      }

      if (isMatch) {
        results.push({
          file: relativePath,
          line: lineNumber,
          content: line.trim()
        });
      }
    }
  }
  finally {
    await handle.close();
  }

  return results;
}

export function isPathInside(
  thePath: string,
  potentialParent: string
): boolean {
  // For inside-directory checking, we want to allow trailing slashes, so normalize.
  thePath = path.resolve(stripTrailingSep(thePath));
  potentialParent = path.resolve(stripTrailingSep(potentialParent));

  // Node treats only Windows as case-insensitive in its path module; we follow those conventions.
  if (process.platform === "win32") {
    thePath = thePath.toLowerCase();
    potentialParent = potentialParent.toLowerCase();
  }

  return thePath.startsWith(potentialParent) &&
    (
      thePath.at(potentialParent.length) === path.sep ||
      thePath.at(potentialParent.length) === undefined
    );
}

function stripTrailingSep(
  thePath: string
): string {
  return thePath.at(-1) === path.sep ? thePath.slice(0, -1) : thePath;
}
