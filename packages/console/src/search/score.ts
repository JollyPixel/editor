// Import Internal Dependencies
import { SearchText } from "./SearchText.ts";
import {
  loweredPrefixDistance,
  typoTolerance
} from "./typo.ts";

// CONSTANTS
const kWalk = {
  positions: new Int32Array(32),
  failed: new Uint32Array(1024),
  generation: 0
};

export type MatchTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface MatchRange {
  start: number;
  end: number;
}

export interface Match {
  tier: MatchTier;
  score: number;
  ranges: MatchRange[];
}

export const MATCH_TIERS = {
  exact: 1,
  prefix: 2,
  wordBoundary: 3,
  substring: 4,
  subsequence: 5,
  typo: 6
} as const;

export function score(
  query: string,
  candidate: string
): Match | null {
  return matchText(new SearchText(query), new SearchText(candidate));
}

export function scoreTypo(
  query: string,
  candidate: string
): Match | null {
  return matchTypo(new SearchText(query), new SearchText(candidate));
}

export function matchText(
  query: SearchText,
  text: SearchText
): Match | null {
  const needle = query.lowered;
  const haystack = text.lowered;
  if (
    needle === "" ||
    needle.length > haystack.length ||
    text.lacks(query) !== 0 ||
    !isSubsequence(needle, haystack)
  ) {
    return null;
  }

  if (haystack === needle) {
    return match(MATCH_TIERS.exact, 1, 0, needle.length);
  }
  if (haystack.startsWith(needle)) {
    const coverage = needle.length / haystack.length;

    return match(MATCH_TIERS.prefix, coverage, 0, needle.length);
  }

  const { starts } = text;
  const humps = matchWordBoundaries(needle, haystack, starts);
  if (humps !== null) {
    return {
      tier: MATCH_TIERS.wordBoundary,
      score: 1 / humps.length - haystack.length / 1000,
      ranges: humps
    };
  }

  const index = haystack.indexOf(needle);
  if (index !== -1) {
    const boundary = starts[index] === 1 ? 1 : 0.5;

    return match(
      MATCH_TIERS.substring,
      boundary - index / 1000,
      index,
      index + needle.length
    );
  }

  return matchSubsequence(needle, haystack);
}

export function matchTypo(
  query: SearchText,
  text: SearchText
): Match | null {
  const needle = query.lowered;
  const tolerance = typoTolerance(needle.length);
  if (tolerance === 0 || text.lacks(query) > tolerance) {
    return null;
  }

  const { lowered, starts } = text;
  let best = Infinity;
  for (let index = 0; index < starts.length; index++) {
    if (starts[index] === 1) {
      const found = loweredPrefixDistance(needle, lowered, index);
      if (found !== null && found < best) {
        best = found;
      }
    }
  }
  if (best === Infinity) {
    return null;
  }

  return {
    tier: MATCH_TIERS.typo,
    score: 1 - best / needle.length,
    ranges: []
  };
}

function match(
  tier: MatchTier,
  value: number,
  start: number,
  end: number
): Match {
  return {
    tier,
    score: value,
    ranges: [{ start, end }]
  };
}

function isSubsequence(
  needle: string,
  haystack: string
): boolean {
  let from = 0;
  for (let index = 0; index < needle.length; index++) {
    const found = haystack.indexOf(needle[index], from);
    if (found === -1) {
      return false;
    }
    from = found + 1;
  }

  return true;
}

function matchSubsequence(
  needle: string,
  haystack: string
): Match {
  const positions = reserve(needle.length);
  let from = 0;
  for (let index = 0; index < needle.length; index++) {
    positions[index] = haystack.indexOf(needle[index], from);
    from = positions[index] + 1;
  }
  const span = positions[needle.length - 1] - positions[0] + 1;

  return {
    tier: MATCH_TIERS.subsequence,
    score: needle.length / span,
    ranges: toRanges(positions, needle.length)
  };
}

function matchWordBoundaries(
  needle: string,
  haystack: string,
  starts: Uint8Array
): MatchRange[] | null {
  const cells = needle.length * (haystack.length + 1);
  if (kWalk.failed.length < cells) {
    kWalk.failed = new Uint32Array(cells);
  }
  kWalk.generation = (kWalk.generation + 1) >>> 0;
  if (kWalk.generation === 0) {
    kWalk.failed.fill(0);
    kWalk.generation = 1;
  }
  const positions = reserve(needle.length);

  return walk(needle, haystack, starts, 0, -1) ?
    toRanges(positions, needle.length) :
    null;
}

function walk(
  needle: string,
  haystack: string,
  starts: Uint8Array,
  queryIndex: number,
  previous: number
): boolean {
  if (queryIndex === needle.length) {
    return true;
  }
  const key = queryIndex * (haystack.length + 1) + previous + 1;
  if (kWalk.failed[key] === kWalk.generation) {
    return false;
  }

  const char = needle.charCodeAt(queryIndex);
  const next = previous + 1;
  if (previous >= 0 && haystack.charCodeAt(next) === char) {
    kWalk.positions[queryIndex] = next;
    if (walk(needle, haystack, starts, queryIndex + 1, next)) {
      return true;
    }
  }
  const from = previous >= 0 ? next + 1 : 0;
  for (let index = from; index < haystack.length; index++) {
    if (starts[index] === 1 && haystack.charCodeAt(index) === char) {
      kWalk.positions[queryIndex] = index;
      if (walk(needle, haystack, starts, queryIndex + 1, index)) {
        return true;
      }
    }
  }
  kWalk.failed[key] = kWalk.generation;

  return false;
}

function reserve(
  length: number
): Int32Array {
  if (kWalk.positions.length < length) {
    kWalk.positions = new Int32Array(length);
  }

  return kWalk.positions;
}

function toRanges(
  positions: Int32Array,
  count: number
): MatchRange[] {
  const ranges: MatchRange[] = [];
  let last: MatchRange | null = null;
  for (let index = 0; index < count; index++) {
    const position = positions[index];
    if (last !== null && last.end === position) {
      last.end++;
    }
    else {
      last = {
        start: position,
        end: position + 1
      };
      ranges.push(last);
    }
  }

  return ranges;
}
