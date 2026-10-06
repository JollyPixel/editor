// Import Internal Dependencies
import type {
  ConsoleRegistry,
  RegisteredEntry
} from "../registry/types.ts";
import {
  MATCH_TIERS,
  score,
  scoreTypo,
  type Match,
  type MatchTier
} from "./score.ts";
import {
  entrySuggestion,
  type Suggestion,
  type SuggestionMatch
} from "./suggestion.ts";

export interface SearchResult extends Suggestion {
  match: SuggestionMatch;
  tier: MatchTier;
  score: number;
}

export function search(
  query: string,
  registry: ConsoleRegistry
): SearchResult[] {
  const needle = query.trim();
  if (needle === "") {
    return [];
  }

  const results: SearchResult[] = [];
  for (const target of targets(registry)) {
    const result = rank(needle, target);
    if (result !== null) {
      results.push(result);
    }
  }

  return results.sort(compare);
}

function* targets(
  registry: ConsoleRegistry
): IterableIterator<RegisteredEntry> {
  for (const scope of registry) {
    if (scope !== registry.root) {
      yield scope;
    }
    yield* scope;
  }
}

function rank(
  query: string,
  target: RegisteredEntry
): SearchResult | null {
  const byName = score(query, target.address);
  if (byName !== null) {
    return nameResult(target, byName);
  }

  const byDescription = score(query, target.description);
  if (
    byDescription !== null &&
    byDescription.tier !== MATCH_TIERS.subsequence
  ) {
    return {
      ...entrySuggestion(target),
      match: {
        field: "detail",
        ranges: byDescription.ranges
      },
      tier: byDescription.tier,
      score: byDescription.score
    };
  }

  const byTypo = scoreTypo(query, target.address);

  return byTypo === null ? null : nameResult(target, byTypo);
}

function nameResult(
  target: RegisteredEntry,
  found: Match
): SearchResult {
  const suggestion = entrySuggestion(target);
  const shift = suggestion.label.length - target.address.length;

  return {
    ...suggestion,
    detail: target.kind === "variable" ?
      `variable  ${target.def.type}` :
      suggestion.detail,
    match: {
      field: "label",
      ranges: found.ranges.map((range) => {
        return {
          start: range.start + shift,
          end: range.end + shift
        };
      })
    },
    tier: found.tier,
    score: found.score
  };
}

function compare(
  left: SearchResult,
  right: SearchResult
): number {
  const byGroup = group(left) - group(right);
  if (byGroup !== 0) {
    return byGroup;
  }
  if (left.tier !== right.tier) {
    return left.tier - right.tier;
  }
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.label.localeCompare(right.label);
}

function group(
  result: SearchResult
): number {
  if (result.match.field === "detail") {
    return 1;
  }

  return result.tier === MATCH_TIERS.typo ? 2 : 0;
}
