export type MatchTier = 1 | 2 | 3 | 4 | 5;

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
  subsequence: 5
} as const;

export function score(
  query: string,
  candidate: string
): Match | null {
  const needle = query.toLowerCase();
  const haystack = candidate.toLowerCase();
  if (needle === "" || needle.length > haystack.length) {
    return null;
  }
  const scattered = matchSubsequence(needle, haystack);
  if (scattered === null) {
    return null;
  }

  if (haystack === needle) {
    return match(MATCH_TIERS.exact, 1, [0, needle.length]);
  }
  if (haystack.startsWith(needle)) {
    const coverage = needle.length / haystack.length;

    return match(MATCH_TIERS.prefix, coverage, [0, needle.length]);
  }

  const starts = wordStarts(candidate);
  const humps = matchWordBoundaries(needle, haystack, starts);
  if (humps !== null) {
    const segments = toRanges(humps);

    return {
      tier: MATCH_TIERS.wordBoundary,
      score: 1 / segments.length - haystack.length / 1000,
      ranges: segments
    };
  }

  const index = haystack.indexOf(needle);
  if (index !== -1) {
    const boundary = starts[index] ? 1 : 0.5;

    const end = index + needle.length;

    return match(MATCH_TIERS.substring, boundary - index / 1000, [index, end]);
  }

  const span = scattered[scattered.length - 1] - scattered[0] + 1;

  return {
    tier: MATCH_TIERS.subsequence,
    score: needle.length / span,
    ranges: toRanges(scattered)
  };
}

function match(
  tier: MatchTier,
  value: number,
  [start, end]: [number, number]
): Match {
  return {
    tier,
    score: value,
    ranges: [{ start, end }]
  };
}

function wordStarts(
  candidate: string
): boolean[] {
  return Array.from(candidate, (char, index) => {
    if (index === 0) {
      return isWordChar(char);
    }
    const previous = candidate[index - 1];
    if (!isWordChar(char)) {
      return false;
    }

    return !isWordChar(previous) || (isUpper(char) && !isUpper(previous));
  });
}

function matchWordBoundaries(
  needle: string,
  haystack: string,
  starts: boolean[]
): number[] | null {
  const positions: number[] = [];
  const failed = new Set<number>();

  function walk(
    queryIndex: number,
    previous: number
  ): boolean {
    if (queryIndex === needle.length) {
      return true;
    }
    const key = queryIndex * (haystack.length + 1) + previous + 1;
    if (failed.has(key)) {
      return false;
    }

    const next = previous + 1;
    if (previous >= 0 && haystack[next] === needle[queryIndex]) {
      positions.push(next);
      if (walk(queryIndex + 1, next)) {
        return true;
      }
      positions.pop();
    }
    const from = previous >= 0 ? next + 1 : 0;
    for (let index = from; index < haystack.length; index++) {
      if (starts[index] && haystack[index] === needle[queryIndex]) {
        positions.push(index);
        if (walk(queryIndex + 1, index)) {
          return true;
        }
        positions.pop();
      }
    }
    failed.add(key);

    return false;
  }

  return walk(0, -1) ? positions : null;
}

function matchSubsequence(
  needle: string,
  haystack: string
): number[] | null {
  const positions: number[] = [];
  let from = 0;
  for (const char of needle) {
    const index = haystack.indexOf(char, from);
    if (index === -1) {
      return null;
    }
    positions.push(index);
    from = index + 1;
  }

  return positions;
}

function toRanges(
  positions: number[]
): MatchRange[] {
  const ranges: MatchRange[] = [];
  for (const position of positions) {
    const last = ranges.at(-1);
    if (last !== undefined && last.end === position) {
      last.end++;
    }
    else {
      ranges.push({ start: position, end: position + 1 });
    }
  }

  return ranges;
}

function isWordChar(
  char: string
): boolean {
  return (char >= "a" && char <= "z") ||
    isUpper(char) ||
    (char >= "0" && char <= "9");
}

function isUpper(
  char: string
): boolean {
  return char >= "A" && char <= "Z";
}
