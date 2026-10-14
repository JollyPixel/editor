// Import Internal Dependencies
import type { SearchQuery } from "./SearchQuery.ts";

// CONSTANTS
const kSearchMissAttribute = "data-search-miss";

export interface Searchable {
  applySearch(query: SearchQuery): number;
}

export interface SearchResult {
  matches: number;
  participants: number;
}

export function searchElements(
  elements: Iterable<Element>,
  query: SearchQuery
): SearchResult {
  const result: SearchResult = {
    matches: 0,
    participants: 0
  };
  for (const element of elements) {
    if (!isSearchable(element)) {
      continue;
    }

    const matches = element.applySearch(query);
    result.participants += 1;
    result.matches += matches;
    element.toggleAttribute(
      kSearchMissAttribute,
      !query.isEmpty && matches === 0
    );
  }

  return result;
}

function isSearchable(
  element: Element
): element is Element & Searchable {
  return "applySearch" in element &&
    typeof element.applySearch === "function";
}
