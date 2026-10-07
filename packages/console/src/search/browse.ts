// Import Internal Dependencies
import { peekValue } from "../execution/variables.ts";
import {
  isWithin,
  relativeAddress
} from "../registry/address.ts";
import {
  byName,
  compareText
} from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredEntry
} from "../registry/types.ts";
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
  const { scope } = registry;
  function scoped(
    entry: RegisteredEntry
  ): Suggestion {
    return entrySuggestion(entry, relativeAddress(entry.address, scope.address));
  }

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
      items: [...registry.children(scope)].sort(byName).map(scoped)
    },
    {
      kind: "commands",
      items: [...scope.commands()].sort(byName).map(scoped)
    },
    {
      kind: "variables",
      items: [...scope.variables()]
        .filter((variable) => variable.def.type !== "boolean")
        .sort(byName)
        .map(scoped)
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
  const scope = registry.scope.address;
  const variables = [...registry]
    .flatMap((namespace) => [...namespace.variables()])
    .filter((variable) => variable.def.type === "boolean" &&
      isWithin(variable.address, scope))
    .sort((left, right) => compareText(left.address, right.address));
  for (const variable of variables) {
    const checked = peekValue(variable);
    if (typeof checked === "boolean") {
      const address = relativeAddress(variable.address, scope);
      const text = `${address} ${!checked}`;
      items.push({
        ...entrySuggestion(variable, address),
        checked,
        text,
        caret: text.length,
        run: true
      });
    }
  }

  return items;
}
