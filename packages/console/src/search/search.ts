// Import Internal Dependencies
import { compareText } from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredEntry
} from "../registry/types.ts";
import {
  MATCH_TIERS,
  matchText,
  matchTypo,
  type Match,
  type MatchTier
} from "./score.ts";
import { SearchTarget } from "./SearchTarget.ts";
import { SearchText } from "./SearchText.ts";
import {
  entrySuggestion,
  type Suggestion,
  type SuggestionMatch
} from "./suggestion.ts";
import { TopRanked } from "./TopRanked.ts";

export interface SearchResult extends Suggestion {
  match: SuggestionMatch;
  tier: MatchTier;
  score: number;
}

interface RankedTarget {
  target: SearchTarget;
  field: SuggestionMatch["field"];
  found: Match;
  group: number;
}

export function search(
  query: string,
  registry: ConsoleRegistry,
  limit = Infinity
): SearchResult[] {
  const needle = new SearchText(query.trim());
  if (needle.text === "") {
    return [];
  }

  const ranked = new TopRanked(limit, compare);
  for (const scope of registry) {
    if (scope !== registry.root) {
      rank(needle, scope, ranked);
    }
    for (const entry of scope) {
      rank(needle, entry, ranked);
    }
  }

  return ranked.sorted().map(toResult);
}

function rank(
  needle: SearchText,
  entry: RegisteredEntry,
  ranked: TopRanked<RankedTarget>
): void {
  const target = SearchTarget.of(entry);
  const byName = matchText(needle, target.address);
  if (byName !== null) {
    ranked.add({
      target,
      field: "label",
      found: byName,
      group: 0
    });

    return;
  }

  const byDescription = matchText(needle, target.description);
  if (
    byDescription !== null &&
    byDescription.tier !== MATCH_TIERS.subsequence
  ) {
    ranked.add({
      target,
      field: "detail",
      found: byDescription,
      group: 1
    });

    return;
  }

  const byTypo = matchTypo(needle, target.address);
  if (byTypo !== null) {
    ranked.add({
      target,
      field: "label",
      found: byTypo,
      group: 2
    });
  }
}

function toResult(
  ranked: RankedTarget
): SearchResult {
  const { target, field, found } = ranked;
  const { entry } = target;
  const suggestion = entrySuggestion(entry);
  if (field === "detail") {
    return {
      ...suggestion,
      match: {
        field,
        ranges: found.ranges
      },
      tier: found.tier,
      score: found.score
    };
  }

  const shift = target.label.length - entry.address.length;

  return {
    ...suggestion,
    detail: entry.kind === "variable" ?
      `variable  ${entry.def.type}` :
      suggestion.detail,
    match: {
      field,
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
  left: RankedTarget,
  right: RankedTarget
): number {
  if (left.group !== right.group) {
    return left.group - right.group;
  }
  if (left.found.tier !== right.found.tier) {
    return left.found.tier - right.found.tier;
  }
  if (left.found.score !== right.found.score) {
    return right.found.score - left.found.score;
  }

  return compareText(left.target.label, right.target.label);
}
