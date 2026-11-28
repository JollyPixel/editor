// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import "@jolly-pixel/editor.script/markdown";
import "@jolly-pixel/ui/elements/message";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { BrowserState } from "../../browser/BrowserState.ts";
import { cardStyles } from "../cardStyles.ts";
import { navMenuStyles } from "../navMenuStyles.ts";
import { navRowStyles } from "../navRowStyles.ts";
import {
  DocsLibrary,
  type DocsBook,
  type DocsPage
} from "./DocsLibrary.ts";

type DocsView =
  | { readonly state: "empty"; readonly page?: undefined; }
  | { readonly state: "loading"; readonly page: DocsPage; }
  | { readonly state: "failed"; readonly page: DocsPage; readonly reason: string; }
  | { readonly state: "ready"; readonly page: DocsPage; readonly markdown: string; };

@customElement("studio-docs")
export class StudioDocs extends LitElement {
  static override styles = [cardStyles, navRowStyles, navMenuStyles, css`
    :host {
      display: flex;
      gap: var(--studio-gutter);
      width: 100%;
      height: 100%;
    }

    :host([hidden]) {
      display: none;
    }

    nav h4 {
      margin: var(--jolly-space-2) 0 0;
      padding: var(--jolly-space-1) var(--jolly-space-3);
      color: var(--jolly-text-muted);
      font-size: 0.85em;
      font-weight: 600;
    }

    section.card {
      flex: 1 1 auto;
    }

    jolly-markdown::part(article) {
      max-width: clamp(80ch, 75%, 110ch);
      margin-inline: auto;
    }
  `];

  @property({ attribute: false })
  declare library: DocsLibrary;

  @property({ attribute: false })
  declare browserState: BrowserState;

  @state()
  declare _view: DocsView;

  @query(".card-body")
  declare _body: HTMLElement | null;

  constructor() {
    super();
    this.library = DocsLibrary.EMPTY;
    this.browserState = new BrowserState();
    this._view = { state: "empty" };
  }

  get page(): string {
    return this.browserState.docsPage;
  }

  set page(
    id: string
  ) {
    this.browserState.docsPage = id;
    this.requestUpdate();
  }

  protected override willUpdate(): void {
    const page = this.#current();
    if (page === this._view.page) {
      return;
    }

    if (page === undefined) {
      this._view = { state: "empty" };

      return;
    }

    this._view = { state: "loading", page };
    void this.#load(page);
  }

  protected override updated(
    changed: PropertyValues<this>
  ): void {
    const previous = changed.get("_view");
    if (previous !== undefined && previous.page !== this._view.page) {
      this._body?.scrollTo({ top: 0 });
    }
  }

  override render(): TemplateResult {
    const current = this._view.page;

    return html`
      <div class="card menu">
        <nav aria-label="Documentation pages">
          ${this.library.books.map(
            (book, index) => this.#book(book, index, current)
          )}
        </nav>
      </div>
      <section class="card" aria-label=${current?.title ?? "Docs"}>
        <div class="card-body">${this.#body(this._view)}</div>
      </section>
    `;
  }

  #book(
    book: DocsBook,
    index: number,
    current: DocsPage | undefined
  ): TemplateResult {
    const headingId = `docs-book-${index}`;

    return html`
      <section aria-labelledby=${headingId}>
        <h3 id=${headingId}>${book.label}</h3>
        ${book.sections.map((section) => html`
          ${section.label === undefined ?
            nothing :
            html`<h4>${section.label}</h4>`}
          <ul>
            ${section.pages.map((page) => html`
              <li>
                <button
                  class="nav-row"
                  type="button"
                  aria-current=${page === current ? "page" : nothing}
                  @click=${() => this.#show(page)}
                ><span>${page.title}</span></button>
              </li>
            `)}
          </ul>
        `)}
      </section>
    `;
  }

  #body(
    view: DocsView
  ): TemplateResult | typeof nothing {
    switch (view.state) {
      case "empty":
        return html`<jolly-message flush>No documentation was built into this studio.</jolly-message>`;
      case "loading":
        return nothing;
      case "failed":
        return html`<jolly-message flush>Could not load ${view.page.title}: ${view.reason}</jolly-message>`;
      case "ready":
        return html`
          <jolly-markdown
            .markdown=${view.markdown}
            @click=${(event: MouseEvent) => this.#followLink(event, view.page)}
          ></jolly-markdown>
        `;
    }
  }

  #current(): DocsPage | undefined {
    return this.library.find(this.page) ?? this.library.first;
  }

  #show(
    page: DocsPage
  ): void {
    this.page = page.id;
  }

  async #load(
    page: DocsPage
  ): Promise<void> {
    let view: DocsView;
    try {
      view = {
        state: "ready",
        page,
        markdown: await page.load()
      };
    }
    catch (error) {
      view = {
        state: "failed",
        page,
        reason: errorMessage(error)
      };
    }

    if (this._view.page === page) {
      this._view = view;
    }
  }

  #followLink(
    event: MouseEvent,
    from: DocsPage
  ): void {
    const link = event.composedPath()
      .find((target) => target instanceof HTMLAnchorElement);
    const href = link?.getAttribute("href") ?? null;
    if (href === null) {
      return;
    }

    const target = this.library.link(from, href);
    if (target === "external") {
      return;
    }

    event.preventDefault();
    if (target !== "missing") {
      this.#show(target);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "studio-docs": StudioDocs;
  }
}
