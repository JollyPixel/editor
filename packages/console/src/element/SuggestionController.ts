// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";

// Import Internal Dependencies
import type { CommandConsole } from "../CommandConsole.ts";
import { classify } from "../input/classify.ts";
import {
  signature,
  variableSignature
} from "../registry/format.ts";
import type {
  ConsoleRegistry,
  RegisteredEntry,
  RegisteredVariable
} from "../registry/types.ts";
import {
  browse,
  type BrowseItem,
  type BrowseSectionKind
} from "../search/browse.ts";
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
const kGroupTitles: Record<BrowseSectionKind, string> = {
  recent: "Recent",
  toggles: "Toggles",
  namespaces: "Namespaces",
  commands: "Commands",
  variables: "Variables"
};
const kNoSuggestions: SuggestionList = {
  items: [],
  groups: null,
  preselect: false,
  hint: null
};

export interface Acceptance {
  text: string;
  caret: number;
  run: boolean;
}

export interface Suggestion {
  label: string;
  detail: string;
  match: SuggestionMatch | null;
  entry: RegisteredEntry | null;
  checked: boolean | null;
  accept(): Acceptance;
}

export interface EntryUsage {
  usage: string;
  description: string;
}

export interface SuggestionControllerOptions {
  listbox: () => HTMLElement | null;
  pick: (index: number) => void;
}

interface SuggestionMatch {
  field: "label" | "detail";
  ranges: MatchRange[];
}

interface SuggestionGroup {
  kind: BrowseSectionKind;
  items: Suggestion[];
}

interface SuggestionList {
  items: Suggestion[];
  groups: SuggestionGroup[] | null;
  preselect: boolean;
  hint: string | null;
}

export class SuggestionController implements ReactiveController {
  #host: ReactiveControllerHost;
  #options: SuggestionControllerOptions;
  #list = kNoSuggestions;
  #highlight = -1;
  #request = 0;
  #listChanged = false;

  constructor(
    host: ReactiveControllerHost,
    options: SuggestionControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get items(): readonly Suggestion[] {
    return this.#list.items;
  }

  get hint(): string | null {
    return this.#list.hint;
  }

  get highlight(): number {
    return this.#highlight;
  }

  get highlighted(): Suggestion | undefined {
    return this.#highlight >= 0 ?
      this.#list.items[this.#highlight] :
      undefined;
  }

  get usage(): EntryUsage | null {
    const entry = this.highlighted?.entry;

    return entry ? entryUsage(entry) : null;
  }

  hostUpdated(): void {
    const listbox = this.#options.listbox();
    if (listbox === null) {
      return;
    }

    if (this.#listChanged || this.#highlight === 0) {
      listbox.scrollTop = 0;
    }
    else {
      const option = listbox.querySelector<HTMLElement>(
        "[role=option][aria-selected=true]"
      );
      const group = option?.closest<HTMLElement>(".group");
      const leads = group?.querySelector("[role=option]") === option;
      if (option) {
        revealWithin(listbox, leads && group ? group : option, option);
      }
    }
    this.#listChanged = false;
  }

  clear(): void {
    this.#request++;
    this.#show(kNoSuggestions);
  }

  cancel(): void {
    this.#request++;
  }

  async refresh(
    commands: CommandConsole,
    text: string,
    caret: number
  ): Promise<void> {
    const request = ++this.#request;
    const { registry } = commands;
    const classified = classify(text, registry);
    if (classified.mode === "search") {
      this.#show(classified.query === "" ?
        browseList(registry, commands.history.entries) :
        searchList(classified.query, registry));

      return;
    }

    const stale = this.#list.preselect || this.#list.groups !== null;
    this.#show(stale ? kNoSuggestions : this.#list);
    const list = await completionList(text, caret, registry);
    if (request === this.#request) {
      this.#show(list);
    }
  }

  move(
    delta: 1 | -1
  ): void {
    const count = this.#list.items.length;
    if (count === 0) {
      this.#highlight = -1;
    }
    else if (this.#list.preselect) {
      const from = this.#highlight < 0 && delta === -1 ? 0 : this.#highlight;
      this.#highlight = (from + delta + count) % count;
    }
    else {
      this.#highlight = Math.min(Math.max(this.#highlight + delta, -1), count - 1);
    }
    this.#host.requestUpdate();
  }

  accept(
    index: number
  ): Acceptance | null {
    const item = this.#list.items[index];

    return item === undefined ? null : item.accept();
  }

  inlineCompletion(
    input: string
  ): string {
    const item = this.#list.items[Math.max(this.#highlight, 0)];
    if (item === undefined || this.#list.groups !== null) {
      return "";
    }

    const { text } = item.accept();
    const continues = text.length > input.length &&
      text.toLowerCase().startsWith(input.toLowerCase());

    return continues ? text.slice(input.length) : "";
  }

  renderOptions(): TemplateResult[] {
    const { items, groups } = this.#list;
    if (groups === null) {
      return items.map((item, index) => this.#renderOption(item, index));
    }

    let offset = 0;

    return groups.map((group) => {
      const start = offset;
      offset += group.items.length;
      const id = `group-${group.kind}`;
      const chips = group.kind === "toggles";

      return html`
        <li role="group" class="group" aria-labelledby=${id}>
          <div id=${id} class="group-title">${kGroupTitles[group.kind]}</div>
          <ul role="none" class=${chips ? "chips" : "rows"}>${group.items.map(
            (item, index) => (chips ?
              this.#renderChip(item, start + index) :
              this.#renderOption(item, start + index))
          )}</ul>
        </li>
      `;
    });
  }

  #show(
    list: SuggestionList
  ): void {
    this.#list = list;
    this.#listChanged = true;
    this.#highlight = list.preselect && list.items.length > 0 ? 0 : -1;
    this.#host.requestUpdate();
  }

  #renderOption(
    item: Suggestion,
    index: number
  ): TemplateResult {
    const { match } = item;

    return html`
      <li
        id=${`option-${index}`}
        role="option"
        aria-selected=${index === this.#highlight ? "true" : "false"}
        @click=${() => this.#options.pick(index)}
      >
        <span class="label">${match?.field === "label" ?
          marked(item.label, match.ranges) :
          item.label}</span>
        <span class="detail">${match?.field === "detail" ?
          marked(item.detail, match.ranges) :
          item.detail}</span>
      </li>
    `;
  }

  #renderChip(
    item: Suggestion,
    index: number
  ): TemplateResult {
    return html`
      <li
        id=${`option-${index}`}
        role="option"
        title=${item.detail}
        aria-selected=${index === this.#highlight ? "true" : "false"}
        aria-checked=${item.checked ? "true" : "false"}
        @click=${() => this.#options.pick(index)}
      >
        <span class="box" aria-hidden="true">${item.checked ?
          html`<jolly-icon name="check"></jolly-icon>` :
          nothing}</span>
        <span class="label">${item.label}</span>
      </li>
    `;
  }
}

function browseList(
  registry: ConsoleRegistry,
  history: readonly string[]
): SuggestionList {
  const groups = browse(registry, history).map((section) => {
    return {
      kind: section.kind,
      items: section.items.map(browseSuggestion)
    };
  });

  return {
    items: groups.flatMap((group) => group.items),
    groups,
    preselect: false,
    hint: null
  };
}

function searchList(
  query: string,
  registry: ConsoleRegistry
): SuggestionList {
  return {
    items: search(query, registry)
      .slice(0, kMaxResults)
      .map(resultSuggestion),
    groups: null,
    preselect: true,
    hint: null
  };
}

async function completionList(
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
        entry: item.entry,
        checked: null,
        accept: () => {
          return {
            ...applyCompletion(input, list, item),
            run: false
          };
        }
      };
    }),
    groups: null,
    preselect: false,
    hint: list.hint
  };
}

function browseSuggestion(
  item: BrowseItem
): Suggestion {
  return {
    label: item.label,
    detail: item.detail,
    match: null,
    entry: item.entry,
    checked: item.checked,
    accept: () => {
      return {
        text: item.text,
        caret: item.text.length,
        run: item.run
      };
    }
  };
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
    entry: target,
    checked: null,
    accept: () => {
      const selection = select(result);

      return {
        ...selection,
        caret: selection.text.length
      };
    }
  };
}

function entryUsage(
  entry: RegisteredEntry
): EntryUsage {
  switch (entry.kind) {
    case "command":
      return {
        usage: signature(entry),
        description: entry.def.description
      };
    case "variable":
      return {
        usage: variableUsage(entry),
        description: entry.def.description
      };
    default: {
      const counts = [
        count([...entry.commands()].length, "command"),
        count([...entry.variables()].length, "variable")
      ];

      return {
        usage: `${entry.name}.`,
        description: [entry.description, counts.join(", ")]
          .filter((part) => part !== "")
          .join(": ")
      };
    }
  }
}

function variableUsage(
  variable: RegisteredVariable
): string {
  const text = variableSignature(variable);
  try {
    return `${text} = ${String(variable.def.get())}`;
  }
  catch {
    return text;
  }
}

function count(
  amount: number,
  noun: string
): string {
  return `${amount} ${noun}${amount === 1 ? "" : "s"}`;
}

function revealWithin(
  container: HTMLElement,
  start: HTMLElement,
  end: HTMLElement
): void {
  const box = container.getBoundingClientRect();
  const top = start.getBoundingClientRect().top;
  const bottom = end.getBoundingClientRect().bottom;
  if (top < box.top) {
    container.scrollTop -= box.top - top;
  }
  else if (bottom > box.bottom) {
    container.scrollTop += Math.min(bottom - box.bottom, top - box.top);
  }
}

function marked(
  text: string,
  ranges: MatchRange[]
): TemplateResult {
  const parts: (TemplateResult | string)[] = [];
  let cursor = 0;
  for (const { start, end } of ranges) {
    parts.push(text.slice(cursor, start));
    parts.push(html`<mark>${text.slice(start, end)}</mark>`);
    cursor = end;
  }
  parts.push(text.slice(cursor));

  return html`${parts}`;
}
