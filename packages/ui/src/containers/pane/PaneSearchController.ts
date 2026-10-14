// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { emitContainerEvent } from "../events.ts";
import type { Search } from "../../controls/Search.ts";
import type { JollyChangeDetail } from "../../field/events.ts";
import { SearchQuery } from "../../search/SearchQuery.ts";
import {
  searchElements,
  type SearchResult
} from "../../search/Searchable.ts";

export type PaneSearchHost = ReactiveControllerHost & HTMLElement;

export interface PaneSearchOptions {
  enabled(): boolean;
  field(): Search | null;
  content(): Iterable<Element>;
  announce(message: string): void;
}

export class PaneSearchController implements ReactiveController {
  readonly #host: PaneSearchHost;
  readonly #options: PaneSearchOptions;
  #query = SearchQuery.EMPTY;
  #result: SearchResult = {
    matches: 0,
    participants: 0
  };

  constructor(
    host: PaneSearchHost,
    options: PaneSearchOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
    host.addEventListener("keydown", this.#onKeyDown);
  }

  get query(): SearchQuery {
    return this.#query;
  }

  get noMatches(): boolean {
    return !this.#query.isEmpty &&
      this.#result.participants > 0 &&
      this.#result.matches === 0;
  }

  hostUpdate(): void {
    if (!this.#options.enabled()) {
      this.search("");
    }
  }

  async open(): Promise<void> {
    if (!this.#options.enabled()) {
      return;
    }

    await this.#host.updateComplete;
    await this.#options.field()?.open();
  }

  search(
    text: string
  ): void {
    const query = new SearchQuery(text);
    if (query.equals(this.#query)) {
      return;
    }

    this.#query = query;
    this.#apply();
    emitContainerEvent(this.#host, "jolly-search", {
      query: query.text
    });
    if (!query.isEmpty && this.#result.participants > 0) {
      this.#options.announce(matchesMessage(this.#result.matches));
    }
    this.#host.requestUpdate();
  }

  onInput = (
    event: CustomEvent<JollyChangeDetail<string>>
  ) => {
    event.stopPropagation();
    this.search(event.detail.value);
  };

  onContentChange = () => {
    if (!this.#query.isEmpty) {
      this.#apply();
      this.#host.requestUpdate();
    }
  };

  #apply(): void {
    this.#result = searchElements(this.#options.content(), this.#query);
  }

  #onKeyDown = (
    event: KeyboardEvent
  ) => {
    if (
      this.#options.enabled() &&
      !event.defaultPrevented &&
      isFindChord(event)
    ) {
      event.preventDefault();
      void this.open();
    }
  };
}

function isFindChord(
  event: KeyboardEvent
): boolean {
  return (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.key.toLowerCase() === "f";
}

function matchesMessage(
  count: number
): string {
  if (count === 0) {
    return "No matches";
  }

  return count === 1 ? "1 match" : `${count} matches`;
}
