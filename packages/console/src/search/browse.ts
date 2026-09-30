// Import Internal Dependencies
import { label } from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredEntry,
  RegisteredVariable
} from "../registry/types.ts";
import { selectEntry } from "./search.ts";

// CONSTANTS
const kRecentLimit = 3;

export type BrowseSectionKind =
  | "recent"
  | "namespaces"
  | "commands"
  | "variables"
  | "toggles";

export interface BrowseItem {
  label: string;
  detail: string;
  entry: RegisteredEntry | null;
  checked: boolean | null;
  text: string;
  run: boolean;
}

export interface BrowseSection {
  kind: BrowseSectionKind;
  items: BrowseItem[];
}

export function browse(
  registry: ConsoleRegistry,
  history: readonly string[]
): BrowseSection[] {
  const { root } = registry;
  const sections: BrowseSection[] = [
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
      items: [...registry.namespaces()].sort(byName).map(entryItem)
    },
    {
      kind: "commands",
      items: [...root.commands()].sort(byName).map(entryItem)
    },
    {
      kind: "variables",
      items: [...root.variables()]
        .filter((variable) => variable.def.type !== "boolean")
        .sort(byName)
        .map(entryItem)
    }
  ];

  return sections.filter((section) => section.items.length > 0);
}

function recentItems(
  history: readonly string[]
): BrowseItem[] {
  const lines = new Set<string>();
  for (let index = history.length - 1; index >= 0; index--) {
    if (lines.size === kRecentLimit) {
      break;
    }
    lines.add(history[index]);
  }

  return [...lines].map((line) => {
    return {
      label: line,
      detail: "",
      entry: null,
      checked: null,
      text: line,
      run: true
    };
  });
}

function entryItem(
  entry: RegisteredEntry
): BrowseItem {
  return {
    label: label(entry),
    detail: entry.kind === "namespace" ?
      entry.description :
      entry.def.description,
    entry,
    checked: null,
    ...selectEntry(entry)
  };
}

function toggleItems(
  registry: ConsoleRegistry
): BrowseItem[] {
  const items: BrowseItem[] = [];
  const variables = [registry.root, ...registry.namespaces()]
    .flatMap((namespace) => [...namespace.variables()])
    .sort((left, right) => left.address.localeCompare(right.address));
  for (const variable of variables) {
    const checked = booleanValue(variable);
    if (checked !== null) {
      items.push({
        label: variable.address,
        detail: variable.def.description,
        entry: variable,
        checked,
        text: `${variable.address} ${!checked}`,
        run: true
      });
    }
  }

  return items;
}

function booleanValue(
  variable: RegisteredVariable
): boolean | null {
  const { def } = variable;
  if (def.type !== "boolean") {
    return null;
  }

  try {
    return def.get();
  }
  catch {
    return null;
  }
}

function byName(
  left: { name: string; },
  right: { name: string; }
): number {
  return left.name.localeCompare(right.name);
}
