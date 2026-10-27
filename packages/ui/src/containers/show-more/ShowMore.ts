// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import "../../icon/Icon.ts";
import { defaultSlotChildren } from "../../dom.ts";
import { overflowRows } from "./overflowRows.ts";
import { showMoreStyles } from "./ShowMore.styles.ts";
import { defaultStorageAdapter } from "../../storage/defaultStorage.ts";
import { NamespacedStore } from "../../storage/NamespacedStore.ts";
import type { StorageAdapter } from "../../storage/StorageAdapter.ts";
import { hiddenStyles } from "../../theme/styles/hiddenStyles.ts";
import type { SearchQuery } from "../../search/SearchQuery.ts";
import {
  searchElements,
  type Searchable
} from "../../search/Searchable.ts";
import { searchMissStyles } from "../../search/searchMissStyles.ts";

// CONSTANTS
const kOverflowAttribute = "data-show-more-overflow";

@customElement("jolly-show-more")
export class ShowMore extends LitElement implements Searchable {
  static override styles = [
    showMoreStyles,
    hiddenStyles,
    searchMissStyles
  ];

  @property({ type: Number })
  declare limit: number;

  @property({ type: Boolean, reflect: true })
  declare expanded: boolean;

  @property({
    type: String,
    attribute: "storage-key"
  })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  #overflow: readonly Element[] = [];
  #searching = false;
  #state = new NamespacedStore({
    namespace: () => this.storageKey,
    storage: () => this.storage
  });

  constructor() {
    super();

    this.limit = 5;
    this.expanded = false;
    this.storageKey = "";
    this.storage = defaultStorageAdapter();
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("storageKey") || changed.has("storage")) {
      this.expanded = this.#state.readBoolean("expanded") ?? this.expanded;
    }

    this.#overflow = this.#searching ?
      [] :
      overflowRows(defaultSlotChildren(this), this.limit);
  }

  override render(): TemplateResult {
    return html`
      <slot @slotchange=${() => this.requestUpdate()}></slot>
      ${this.#overflow.length === 0 ? nothing : this.#renderToggle()}
    `;
  }

  protected override updated(): void {
    const collapsed = this.expanded ? [] : this.#overflow;
    let focusLost = false;
    for (const child of defaultSlotChildren(this)) {
      const hidden = collapsed.includes(child);
      if (hidden && !child.hasAttribute(kOverflowAttribute)) {
        focusLost ||= child.matches(":focus-within");
      }
      child.toggleAttribute(kOverflowAttribute, hidden);
    }

    if (focusLost) {
      this.renderRoot.querySelector<HTMLButtonElement>(".toggle")?.focus();
    }
  }

  applySearch(
    query: SearchQuery
  ): number {
    const { matches } = searchElements(defaultSlotChildren(this), query);
    this.#searching = !query.isEmpty;
    this.requestUpdate();

    return matches;
  }

  #renderToggle(): TemplateResult {
    return html`<div class="more"><button
      class="toggle"
      part="toggle"
      type="button"
      aria-expanded=${String(this.expanded)}
      @click=${this.#toggle}
    ><span>${this.expanded ? "Show less" : `Show ${this.#overflow.length} more`}</span><jolly-icon
      class="chevron"
      name="chevron"
      aria-hidden="true"
    ></jolly-icon></button></div>`;
  }

  #toggle = () => {
    this.expanded = !this.expanded;
    this.#state.writeBoolean("expanded", this.expanded);
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-show-more": ShowMore;
  }
}
