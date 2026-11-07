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
  state
} from "lit/decorators.js";
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { recordAt } from "../../catalog/recordAt.ts";
import { cardStyles } from "../cardStyles.ts";
import { StudioErrorEvent } from "../StudioErrorEvent.ts";
import type { AssetBrowserOptions } from "../assets/AssetBrowser.ts";
import { assetOpenEvent } from "../assets/assetOpen.ts";

// CONSTANTS
const kReadmePath = "README.md";
const kDecoder = new TextDecoder();
const kStarter = "# Project\n\nPresent the project to the people who join it.\n";
const kAbsoluteUrl = /^[a-z][a-z\d+.-]*:/i;

type ReadmeView =
  | { readonly state: "missing"; }
  | { readonly state: "loading"; readonly record: AssetRecordData; }
  | { readonly state: "failed"; readonly record: AssetRecordData; readonly reason: string; }
  | { readonly state: "ready"; readonly record: AssetRecordData; readonly markdown: string; };

@customElement("project-readme")
export class ProjectReadme extends LitElement {
  static override styles = [
    cardStyles,
    css`
      :host {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
      }

      .card {
        flex: 1 1 auto;
      }

      .empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--jolly-space-3);
        margin: 0;
        color: var(--jolly-text-muted);
      }
    `
  ];

  @property({ attribute: false })
  declare options: AssetBrowserOptions | null;

  @state()
  declare _view: ReadmeView;

  @state()
  declare _creating: boolean;

  #catalog = new SubscriptionController<CatalogClient>(this, (catalog) => {
    catalog.on("change", this.#refresh);
    this.#refresh();

    return [
      () => catalog.off("change", this.#refresh)
    ];
  });

  #shown: string | null = null;

  constructor() {
    super();
    this.options = null;
    this._view = { state: "missing" };
    this._creating = false;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("options") && this.options !== null) {
      this.#catalog.attach(this.options.catalog);
    }
  }

  override render(): TemplateResult {
    const view = this._view;

    return html`
      <section class="card" aria-labelledby="readme-title">
        <div class="card-head">
          <h2 class="card-title" id="readme-title">${kReadmePath}</h2>
          ${view.state === "missing" || !this.#editable(view.record) ?
            nothing :
            html`
              <jolly-button
                @click=${() => this.dispatchEvent(assetOpenEvent(view.record.id))}
              >Edit</jolly-button>
            `}
        </div>
        <div class="card-body">${this.#body(view)}</div>
      </section>
    `;
  }

  #body(
    view: ReadmeView
  ): TemplateResult | typeof nothing {
    switch (view.state) {
      case "missing":
        return this.#missing();
      case "loading":
        return nothing;
      case "failed":
        return html`<p class="empty">Could not read ${kReadmePath}: ${view.reason}</p>`;
      case "ready":
        return html`
          <jolly-markdown
            .markdown=${view.markdown}
            @click=${this.#followLink}
          ></jolly-markdown>
        `;
    }
  }

  #missing(): TemplateResult {
    const kind = this.options?.kinds.resolve(kReadmePath);
    const creatable = kind !== undefined && this.options?.kinds.canEdit(kind.kind) === true;

    return html`
      <div class="empty">
        <p>Add a ${kReadmePath} at the project root to present the project here.</p>
        ${creatable ?
          html`
            <jolly-button
              icon="plus"
              ?disabled=${this._creating}
              @click=${this.#create}
            >Create ${kReadmePath}</jolly-button>
          ` :
          nothing}
      </div>
    `;
  }

  #editable(
    record: AssetRecordData
  ): boolean {
    return this.options?.kinds.canEdit(record.kind) ?? false;
  }

  readonly #refresh = (): void => {
    const catalog = this.#catalog.current;
    const record = catalog === null ? null : recordAt(catalog.records(), kReadmePath);
    if (catalog === null || record === null) {
      this.#shown = null;
      this._view = { state: "missing" };

      return;
    }

    const version = `${record.id}@${record.revision ?? ""}`;
    if (version === this.#shown) {
      return;
    }
    this.#shown = version;
    if (this._view.state === "missing") {
      this._view = { state: "loading", record };
    }
    void this.#load(catalog, record, version);
  };

  async #load(
    catalog: CatalogClient,
    record: AssetRecordData,
    version: string
  ): Promise<void> {
    let view: ReadmeView;
    try {
      const [content] = await Promise.all([
        catalog.read(record.id),
        import("@jolly-pixel/asset.script/markdown")
      ]);
      view = {
        state: "ready",
        record,
        markdown: kDecoder.decode(content)
      };
    }
    catch (error) {
      view = {
        state: "failed",
        record,
        reason: errorMessage(error)
      };
    }

    if (catalog === this.#catalog.current && version === this.#shown) {
      this._view = view;
    }
  }

  readonly #create = async(): Promise<void> => {
    const catalog = this.#catalog.current;
    if (catalog === null || this._creating) {
      return;
    }

    this._creating = true;
    try {
      const assetId = await catalog.create(
        kReadmePath,
        new TextEncoder().encode(kStarter),
        { onConflict: "suffix" }
      );
      this.dispatchEvent(assetOpenEvent(assetId));
    }
    catch (error) {
      this.dispatchEvent(
        StudioErrorEvent.from(error, `Could not create ${kReadmePath}`)
      );
    }
    finally {
      this._creating = false;
    }
  };

  readonly #followLink = (
    event: MouseEvent
  ): void => {
    const link = event.composedPath()
      .find((target) => target instanceof HTMLAnchorElement);
    const href = link?.getAttribute("href") ?? null;
    if (href === null || kAbsoluteUrl.test(href)) {
      return;
    }

    event.preventDefault();
    const path = projectPath(href);
    const catalog = this.#catalog.current;
    const target = path === null || catalog === null ?
      null :
      recordAt(catalog.records(), path);
    if (target !== null) {
      this.dispatchEvent(assetOpenEvent(target.id));
    }
  };
}

function projectPath(
  href: string
): string | null {
  const [path] = href.split(/[?#]/);
  try {
    return path === "" ? null : decodeURI(path).replace(/^\.?\//, "");
  }
  catch {
    return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "project-readme": ProjectReadme;
  }
}
