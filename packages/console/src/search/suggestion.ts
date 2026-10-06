// Import Internal Dependencies
import { label } from "../registry/format.ts";
import type { RegisteredEntry } from "../registry/types.ts";
import type { MatchRange } from "./score.ts";

export interface SuggestionMatch {
  field: "label" | "detail";
  ranges: MatchRange[];
}

export interface Suggestion {
  label: string;
  detail: string;
  entry: RegisteredEntry | null;
  match: SuggestionMatch | null;
  checked: boolean | null;
  text: string;
  caret: number;
  run: boolean;
}

interface Insertion {
  text: string;
  run: boolean;
}

export function entrySuggestion(
  entry: RegisteredEntry
): Suggestion {
  const shown = label(entry);
  const { text, run } = insertion(entry, shown);

  return {
    label: shown,
    detail: entry.description,
    entry,
    match: null,
    checked: null,
    text,
    caret: text.length,
    run
  };
}

export function lineSuggestion(
  line: string
): Suggestion {
  return {
    label: line,
    detail: "",
    entry: null,
    match: null,
    checked: null,
    text: line,
    caret: line.length,
    run: true
  };
}

function insertion(
  entry: RegisteredEntry,
  shown: string
): Insertion {
  switch (entry.kind) {
    case "command":
      return entry.def.args.some((arg) => arg.required) ?
        { text: `${shown} `, run: false } :
        { text: shown, run: true };
    case "variable":
      return { text: shown, run: false };
    default:
      return { text: `${shown}.`, run: false };
  }
}
