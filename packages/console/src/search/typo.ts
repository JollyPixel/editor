// Import Internal Dependencies
import { label } from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredCommand,
  RegisteredVariable
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
  const labels = new Map<string, string>();
  for (const entry of addressable(registry, kind)) {
    labels.set(entry.address, label(entry));
  }
  const address = closest(typed, labels.keys());

  return address === null ? null : labels.get(address) ?? null;
}

function* addressable(
  registry: ConsoleRegistry,
  kind: "command" | "variable"
): IterableIterator<RegisteredCommand | RegisteredVariable> {
  const scopes = [registry.root, ...registry.namespaces()];
  for (const scope of scopes) {
    yield* kind === "command" ? scope.commands() : scope.variables();
  }
}
