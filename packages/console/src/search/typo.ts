// Import Internal Dependencies
import { label } from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredMember
} from "../registry/types.ts";
import {
  distance,
  prefixDistance
} from "./levenshtein.ts";

export function typoTolerance(
  length: number
): number {
  if (length < 4) {
    return 0;
  }

  return length < 8 ? 1 : 2;
}

export function prefixTypoDistance(
  typed: string,
  candidate: string
): number | null {
  return loweredPrefixDistance(
    typed.toLowerCase(),
    candidate.toLowerCase(),
    0
  );
}

export function loweredPrefixDistance(
  needle: string,
  haystack: string,
  from: number
): number | null {
  const tolerance = typoTolerance(needle.length);
  const shortest = needle.length - tolerance;
  const longest = Math.min(
    needle.length + tolerance,
    haystack.length - from
  );
  if (tolerance === 0 || longest < shortest) {
    return null;
  }

  const best = prefixDistance(needle, haystack, from, shortest, longest);

  return best <= tolerance ? best : null;
}

export function closest(
  typed: string,
  candidates: Iterable<string>
): string | null {
  const needle = typed.toLowerCase();
  let best: string | null = null;
  let bestDistance = typoTolerance(needle.length) + 1;
  for (const candidate of candidates) {
    const found = distance(needle, candidate.toLowerCase());
    if (
      found < bestDistance ||
      (found === bestDistance && best !== null && candidate < best)
    ) {
      best = candidate;
      bestDistance = found;
    }
  }

  return best;
}

export function closestAddress(
  typed: string,
  registry: ConsoleRegistry,
  kind: "command" | "variable"
): string | null {
  const entries = new Map<string, RegisteredMember>();
  for (const scope of registry) {
    for (const entry of scope) {
      if (entry.kind === kind) {
        entries.set(entry.address, entry);
      }
    }
  }
  const address = closest(typed, entries.keys());
  const entry = address === null ? undefined : entries.get(address);

  return entry === undefined ? null : label(entry);
}
