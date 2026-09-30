// Import Internal Dependencies
import type { ConsoleRegistry } from "../registry/types.ts";
import {
  applyCompletion,
  complete
} from "../search/complete.ts";
import type { MatchRange } from "../search/score.ts";
import {
  search,
  select,
  type SearchResult
} from "../search/search.ts";

// CONSTANTS
const kMaxResults = 50;

export interface Acceptance {
  text: string;
  caret: number;
  run: boolean;
}

export interface SuggestionMatch {
  field: "label" | "detail";
  ranges: MatchRange[];
}

export interface Suggestion {
  label: string;
  detail: string;
  match: SuggestionMatch | null;
  accept(): Acceptance;
}

export interface SuggestionList {
  items: Suggestion[];
  preselect: boolean;
  hint: string | null;
}

export const NO_SUGGESTIONS: SuggestionList = {
  items: [],
  preselect: false,
  hint: null
};

export function searchSuggestions(
  query: string,
  registry: ConsoleRegistry
): SuggestionList {
  return {
    items: search(query, registry)
      .slice(0, kMaxResults)
      .map(resultSuggestion),
    preselect: true,
    hint: null
  };
}

export async function completionSuggestions(
  input: string,
  caret: number,
  registry: ConsoleRegistry
): Promise<SuggestionList> {
  const list = await complete(input, caret, registry);

  return {
    items: list.items.map((item) => {
      return {
        label: item.label,
        detail: item.detail,
        match: null,
        accept: () => {
          return {
            ...applyCompletion(input, list, item),
            run: false
          };
        }
      };
    }),
    preselect: false,
    hint: list.hint
  };
}

export function inlineCompletion(
  input: string,
  list: SuggestionList,
  highlight: number
): string {
  const item = list.items[Math.max(highlight, 0)];
  if (item === undefined) {
    return "";
  }

  const { text } = item.accept();
  const continues = text.length > input.length &&
    text.toLowerCase().startsWith(input.toLowerCase());

  return continues ? text.slice(input.length) : "";
}

function resultSuggestion(
  result: SearchResult
): Suggestion {
  const { target } = result;
  const detail = result.field === "name" && target.kind === "variable" ?
    `variable  ${target.def.type}` :
    result.description;

  return {
    label: result.label,
    detail,
    match: {
      field: result.field === "name" ? "label" : "detail",
      ranges: result.ranges
    },
    accept: () => {
      const selection = select(result);

      return {
        ...selection,
        caret: selection.text.length
      };
    }
  };
}
