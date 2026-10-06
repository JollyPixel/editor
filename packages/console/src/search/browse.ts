// Import Internal Dependencies
import { peekValue } from "../execution/variables.ts";
import { byName } from "../registry/format.ts";
import type { ConsoleRegistry } from "../registry/types.ts";
import {
  entrySuggestion,
  lineSuggestion,
  type Suggestion
} from "./suggestion.ts";

// CONSTANTS
const kRecentLimit = 3;

export type BrowseSectionKind =
  | "recent"
  | "namespaces"
  | "commands"
  | "variables"
  | "toggles";

export interface SuggestionGroup {
  kind: BrowseSectionKind;
  items: Suggestion[];
}

export function browse(
  registry: ConsoleRegistry,
  history: readonly string[]
): SuggestionGroup[] {
  const { root } = registry;
  const groups: SuggestionGroup[] = [
    {
      kind: "recent",
      items: recentItems(history)
    },
    {
      kind: "toggles",
      items: toggleItems(registry)
    },
    {
      kind: "namespaces",
      items: [...registry.namespaces()].sort(byName).map(entrySuggestion)
    },
    {
      kind: "commands",
      items: [...root.commands()].sort(byName).map(entrySuggestion)
    },
    {
      kind: "variables",
      items: [...root.variables()]
        .filter((variable) => variable.def.type !== "boolean")
        .sort(byName)
        .map(entrySuggestion)
    }
  ];

  return groups.filter((group) => group.items.length > 0);
}

function recentItems(
  history: readonly string[]
): Suggestion[] {
  const lines = new Set<string>();
  for (let index = history.length - 1; index >= 0; index--) {
    if (lines.size === kRecentLimit) {
      break;
    }
    lines.add(history[index]);
  }

  return [...lines].map(lineSuggestion);
}

function toggleItems(
  registry: ConsoleRegistry
): Suggestion[] {
  const items: Suggestion[] = [];
  const variables = [...registry]
    .flatMap((scope) => [...scope.variables()])
    .filter((variable) => variable.def.type === "boolean")
    .sort((left, right) => left.address.localeCompare(right.address));
  for (const variable of variables) {
    const checked = peekValue(variable);
    if (typeof checked === "boolean") {
      const text = `${variable.address} ${!checked}`;
      items.push({
        ...entrySuggestion(variable),
        checked,
        text,
        caret: text.length,
        run: true
      });
    }
  }

  return items;
}
