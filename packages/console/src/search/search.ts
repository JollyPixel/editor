// Import Internal Dependencies
import { label } from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredEntry
} from "../registry/types.ts";
import {
  MATCH_TIERS,
  score,
  scoreTypo,
  type Match,
  type MatchRange,
  type MatchTier
} from "./score.ts";

export interface SearchResult {
  target: RegisteredEntry;
  label: string;
  description: string;
  field: "name" | "description";
  tier: MatchTier;
  score: number;
  ranges: MatchRange[];
}

export interface SearchSelection {
  text: string;
  run: boolean;
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

export function select(
  result: SearchResult
): SearchSelection {
  const { target } = result;
  switch (target.kind) {
    case "command":
      return target.def.args.some((arg) => arg.required) ?
        { text: `${result.label} `, run: false } :
        { text: result.label, run: true };
    case "variable":
      return { text: result.label, run: false };
    default:
      return { text: `${result.label}.`, run: false };
  }
}

function* targets(
  registry: ConsoleRegistry
): IterableIterator<RegisteredEntry> {
  yield* registry.root.commands();
  yield* registry.root.variables();
  for (const namespace of registry.namespaces()) {
    yield namespace;
    yield* namespace.commands();
    yield* namespace.variables();
  }
}

function rank(
  query: string,
  target: RegisteredEntry
): SearchResult | null {
  const text = label(target);
  const description = target.kind === "namespace" ?
    target.description :
    target.def.description;
  const offset = target.kind === "command" ? 1 : 0;

  const byName = score(query, text.slice(offset));
  if (byName !== null) {
    return result(target, text, description, "name", {
      ...byName,
      ranges: byName.ranges.map((range) => {
        return {
          start: range.start + offset,
          end: range.end + offset
        };
      })
    });
  }

  const byDescription = score(query, description);
  if (
    byDescription !== null &&
    byDescription.tier !== MATCH_TIERS.subsequence
  ) {
    return result(target, text, description, "description", byDescription);
  }

  const byTypo = scoreTypo(query, text.slice(offset));

  return byTypo === null ?
    null :
    result(target, text, description, "name", byTypo);
}

function result(
  target: RegisteredEntry,
  text: string,
  description: string,
  field: SearchResult["field"],
  found: Match
): SearchResult {
  return {
    target,
    label: text,
    description,
    field,
    tier: found.tier,
    score: found.score,
    ranges: found.ranges
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
  if (result.field === "description") {
    return 1;
  }

  return result.tier === MATCH_TIERS.typo ? 2 : 0;
}
