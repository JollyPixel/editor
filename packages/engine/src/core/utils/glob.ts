// CONSTANTS
const kRegExpSyntax = /[.+^${}()|[\]\\]/g;

export type NameMatcher = (name: string) => boolean;
export type SegmentMatcher = NameMatcher | "**";
export type PathMatcher = (segments: string[]) => boolean;

export function compileWildcard(
  pattern: string
): NameMatcher {
  const source = pattern
    .replace(kRegExpSyntax, "\\$&")
    .replaceAll("*", ".*")
    .replaceAll("?", ".");
  const expression = new RegExp(`^${source}$`, "s");

  return (name) => expression.test(name);
}

export function compileSegment(
  pattern: string
): SegmentMatcher {
  return pattern === "**" ? pattern : compileWildcard(pattern);
}

export function compileSegments(
  patterns: string[]
): PathMatcher {
  const matchers = patterns.map(compileSegment);

  return (segments) => matchesFrom(matchers, segments, 0, 0);
}

function matchesFrom(
  matchers: SegmentMatcher[],
  segments: string[],
  matcherIndex: number,
  segmentIndex: number
): boolean {
  if (matcherIndex === matchers.length) {
    return segmentIndex === segments.length;
  }

  const matcher = matchers[matcherIndex];
  const hasSegment = segmentIndex < segments.length;
  if (matcher === "**") {
    return (
      matchesFrom(matchers, segments, matcherIndex + 1, segmentIndex) ||
      (hasSegment &&
        matchesFrom(matchers, segments, matcherIndex, segmentIndex + 1))
    );
  }

  return hasSegment &&
    matcher(segments[segmentIndex]) &&
    matchesFrom(matchers, segments, matcherIndex + 1, segmentIndex + 1);
}
