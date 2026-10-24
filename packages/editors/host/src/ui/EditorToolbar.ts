// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type PropertyDeclarations,
  type TemplateResult
} from "lit";
import {
  SubscriptionController,
  readDetail,
  type ContextMenu,
  type ContextMenuItem,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/icon";
import "@jolly-pixel/ui/elements/select";
import { AssetPath } from "@jolly-pixel/asset";
import type { AssetTag } from "@jolly-pixel/asset-server/client";
import type { Lantern } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import type { ConnectionStatus } from "../connection/ConnectionStatus.ts";
import type { EditorTags } from "../session/EditorTags.ts";
import type { EditorTargets } from "../session/EditorTargets.ts";
import type { EditorToolbarSources } from "../session/EditorToolbarSources.ts";
import "./toolbarIcons.ts";

// CONSTANTS
const kCurrentVersion = "";
const kDateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "short",
  timeStyle: "short"
});

interface AssetSelect {
  options: JollyOption<string>[];
  current: string;
}

interface ChangeSource {
  on(
    type: "change",
    listener: () => void
  ): void;
  off(
    type: "change",
    listener: () => void
  ): void;
}

export class EditorToolbar extends LitElement {
  static override properties: PropertyDeclarations = {
    busy: { state: true },
    error: { state: true }
  };

  static override styles = css`
    :host {
      display: block;
      position: relative;
      z-index: 1;
      flex: 0 0 auto;
      min-width: 0;
      background: var(--jolly-surface, #20242b);
      box-shadow: var(
        --jolly-editor-toolbar-shadow,
        0 1px 2px -1px light-dark(rgb(0 0 0 / 8%), rgb(0 0 0 / 25%))
      );
      color: var(--jolly-text, #e6e8eb);
      font-family: var(--jolly-font-family, ui-monospace, monospace);
      font-size: var(--jolly-font-size, 11px);
      container-type: inline-size;
    }

    :host([empty]) {
      display: none;
    }

    .bar {
      display: flex;
      box-sizing: border-box;
      align-items: center;
      gap: var(--jolly-space-3, 12px);
      min-height: calc(
        var(--jolly-row-height, 20px) + (2 * var(--jolly-space-1, 4px))
      );
      padding: 0 var(--jolly-space-2, 8px);
      overflow: clip;

      --jolly-field-inset-start: 0px;
      --jolly-field-inset-end: 0px;
    }

    .bar:has(> .tours) {
      padding-inline-start: var(--jolly-space-1, 4px);
    }

    .group {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
    }

    .asset {
      flex: 1 1 0;
      max-width: 260px;
    }

    .version {
      flex: 3 1 0;
    }

    .group > jolly-select {
      flex: 1 1 0;
      width: 0;
      min-width: 100px;
    }

    .version > jolly-select {
      min-width: 160px;
    }

    .caption {
      flex: none;
      color: var(--jolly-text-muted, #9aa1ab);
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .save-version {
      flex: none;
    }

    #save-version-compact {
      display: none;
    }

    .group > jolly-button[icon-only] {
      --jolly-icon-button-size: var(--jolly-row-height, 20px);

      flex: none;
    }

    .read-only {
      --jolly-icon-size: 12px;

      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
      margin-inline-end: var(--jolly-space-2, 8px);
      color: var(--jolly-warning, #e0a43a);
      font-weight: 600;
      white-space: nowrap;
    }

    .offline {
      --jolly-icon-size: 12px;

      display: inline-flex;
      flex: none;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
      margin-inline-start: auto;
      color: var(--jolly-warning, #e0a43a);
      font-weight: 600;
      white-space: nowrap;
    }

    .tours {
      --jolly-icon-button-size: var(--jolly-row-height, 20px);

      flex: none;
    }

    .error {
      overflow: hidden;
      min-width: 0;
      color: var(--jolly-danger, #e5484d);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    @container (width < 560px) {
      .bar {
        gap: var(--jolly-space-2, 8px);
        padding: 0 var(--jolly-space-1, 4px);
      }

      .caption,
      #save-version {
        display: none;
      }

      #save-version-compact {
        display: inline-flex;
      }

      .group > jolly-select,
      .version > jolly-select {
        min-width: 64px;
      }
    }

    @container (width < 360px) {
      .read-only {
        gap: 0;
        margin-inline-end: 0;
      }

      .read-only .label,
      .offline .label {
        display: none;
      }

      .group > jolly-select,
      .version > jolly-select {
        min-width: 48px;
      }
    }
  `;

  declare protected busy: boolean;
  declare protected error: string | null;

  #assetSelect: AssetSelect | null = null;
  #tours: Lantern | null = null;
  #offline: ConnectionStatus | null = null;

  #sources = new SubscriptionController<EditorToolbarSources | null>(
    this,
    (sources) => {
      void sources?.tags?.load().catch((error: unknown) => {
        this.error = describeError(error);
      });

      return [
        ...this.#repaintOn(sources?.targets ?? null),
        ...this.#repaintOn(sources?.tags ?? null),
        ...this.#repaintOn(sources?.connectionStatus ?? null),
        ...this.#repaintOn(sources?.lantern ?? null)
      ];
    }
  );

  constructor() {
    super();
    this.busy = false;
    this.error = null;
  }

  get sources(): EditorToolbarSources | null {
    return this.#sources.current;
  }

  set sources(
    sources: EditorToolbarSources | null
  ) {
    this.#sources.attach(sources);
  }

  protected override willUpdate(): void {
    const {
      targets = null,
      tags = null,
      connectionStatus = null,
      lantern = null
    } = this.sources ?? {};
    this.#assetSelect = targets === null ? null : assetSelect(targets);
    this.#tours = lantern !== null && lantern.size > 0 ? lantern : null;
    this.#offline = connectionStatus?.online === false ?
      connectionStatus :
      null;
    this.toggleAttribute(
      "empty",
      this.#assetSelect === null &&
      tags === null &&
      this.#tours === null &&
      this.#offline === null
    );
  }

  override render(): TemplateResult {
    const { tags = null } = this.sources ?? {};

    return html`
      <div class="bar">
        ${this.#tours === null ? nothing : this.#renderTours(this.#tours)}
        ${this.#assetSelect === null ?
          nothing :
          this.#renderTargets(this.#assetSelect)}
        ${tags === null ? nothing : this.#renderVersions(tags)}
        ${this.#offline === null ? nothing : this.#renderOffline(this.#offline)}
        ${this.error === null ?
          nothing :
          html`<span class="error" role="alert" title=${this.error}>${this.error}</span>`}
      </div>
    `;
  }

  #renderTours(
    lantern: Lantern
  ): TemplateResult {
    return html`
      <jolly-button
        id="tours"
        class="tours"
        data-tour="tours"
        icon="help"
        icon-only
        label="Tours"
        title="Tours"
        @click=${(event: Event) => this.#onTours(lantern, event)}
      ></jolly-button>
      <jolly-context-menu
        label="Tours"
        @jolly-context-action=${(event: Event) => this.#onTourPicked(lantern, event)}
      ></jolly-context-menu>
    `;
  }

  #onTours(
    lantern: Lantern,
    event: Event
  ): void {
    const tours = [...lantern];
    if (tours.length === 1) {
      lantern.start(tours[0]);

      return;
    }

    const menu = this.shadowRoot?.querySelector<ContextMenu>("jolly-context-menu");
    const button = event.currentTarget;
    if (!menu || !(button instanceof HTMLElement)) {
      return;
    }

    menu.items = tours.map((tour): ContextMenuItem => {
      const item: ContextMenuItem = {
        id: tour.id,
        label: tour.title
      };

      return lantern.seen.has(tour) ? { ...item, icon: "check" } : item;
    });
    const { left, bottom } = button.getBoundingClientRect();
    menu.openAt(left, bottom);
  }

  #onTourPicked(
    lantern: Lantern,
    event: Event
  ): void {
    const detail = readDetail<{ id: string; }>(event);
    if (detail !== null) {
      lantern.start(lantern.tour(detail.id));
    }
  }

  #renderTargets(
    select: AssetSelect
  ): TemplateResult {
    return html`
      <div class="group asset">
        <span class="caption" id="asset-caption">Asset</span>
        <jolly-select
          aria-labelledby="asset-caption"
          .options=${select.options}
          .value=${select.current}
          ?disabled=${this.busy}
          @jolly-change=${this.#onTargetChange}
        ></jolly-select>
      </div>
    `;
  }

  #renderVersions(
    tags: EditorTags
  ): TemplateResult {
    const { viewing } = tags;

    return html`
      <div class="group version">
        <span class="caption" id="version-caption">Version</span>
        <jolly-select
          aria-labelledby="version-caption"
          .options=${versionOptions(tags)}
          .value=${viewing ?? kCurrentVersion}
          ?disabled=${this.busy}
          @jolly-change=${this.#onVersionChange}
        ></jolly-select>
        ${viewing === null ?
          html`
            <jolly-button
              id="save-version"
              class="save-version"
              icon="version-save"
              variant="accent"
              ?disabled=${this.busy}
              @click=${this.#onCreate}
            >Save version</jolly-button>
            <jolly-button
              id="save-version-compact"
              class="save-version"
              icon="version-save"
              icon-only
              variant="accent"
              label="Save version"
              title="Save version"
              ?disabled=${this.busy}
              @click=${this.#onCreate}
            ></jolly-button>
          ` :
          html`
            <span
              class="read-only"
              title="A saved version cannot be edited"
            ><jolly-icon name="lock"></jolly-icon><span class="label">Read-only</span></span>
            <jolly-button
              id="restore-version"
              icon="revert"
              icon-only
              variant="accent"
              label="Restore this version"
              title="Restore this version"
              ?disabled=${this.busy}
              @click=${() => void this.#run(() => this.#restore(tags, viewing))}
            ></jolly-button>
            <jolly-button
              id="delete-version"
              icon="version-delete"
              icon-only
              variant="danger"
              label="Delete this version"
              title="Delete this version"
              ?disabled=${this.busy}
              @click=${() => void this.#run(() => tags.delete(viewing))}
            ></jolly-button>
          `}
      </div>
    `;
  }

  #renderOffline(
    connection: ConnectionStatus
  ): TemplateResult {
    const title = connection.unsaved ?
      "Your changes are kept in this browser and sent once the server is back" :
      "Reconnecting to the server";

    return html`
      <span
        class="offline"
        role="status"
        title=${title}
      ><jolly-icon name="offline"></jolly-icon><span class="label">Offline</span></span>
    `;
  }

  readonly #onCreate = (): void => {
    const tags = this.sources?.tags;
    if (tags) {
      void this.#run(() => tags.create());
    }
  };

  readonly #onTargetChange = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    const targets = this.sources?.targets;
    if (detail !== null && targets) {
      void this.#run(() => targets.open(detail.value));
    }
  };

  readonly #onVersionChange = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    const tags = this.sources?.tags;
    if (detail !== null && tags) {
      void this.#run(() => tags.view(
        detail.value === kCurrentVersion ? null : detail.value
      ));
    }
  };

  async #restore(
    tags: EditorTags,
    name: string
  ): Promise<void> {
    const report = await tags.restore(name);
    if (report !== null && report.missing.length > 0) {
      const missing = report.missing
        .map((reference) => reference.id)
        .join(", ");
      this.error = `Restored, but these assets are missing: ${missing}`;
    }
  }

  async #run(
    task: () => Promise<unknown>
  ): Promise<void> {
    this.busy = true;
    this.error = null;
    try {
      await task();
    }
    catch (error) {
      this.error = describeError(error);
    }
    finally {
      this.busy = false;
    }
  }

  #repaintOn(
    source: ChangeSource | null
  ): Iterable<() => void> {
    if (source === null) {
      return [];
    }

    const repaint = (): void => {
      this.requestUpdate();
    };
    source.on("change", repaint);

    return [
      () => source.off("change", repaint)
    ];
  }
}

function assetSelect(
  targets: EditorTargets
): AssetSelect | null {
  const options = Array.from(targets, (record) => {
    return {
      value: record.id,
      label: new AssetPath(record.path).withoutExtension().toString()
    };
  });

  return options.length < 2 ?
    null :
    {
      options,
      current: targets.current
    };
}

function versionOptions(
  tags: EditorTags
): JollyOption<string>[] {
  const options: JollyOption<string>[] = [
    {
      value: kCurrentVersion,
      label: "Current version"
    }
  ];
  for (const tag of tags) {
    options.push({
      value: tag.name,
      label: [tag.name, formatCreatedAt(tag), tag.message]
        .filter(Boolean)
        .join(" · ")
    });
  }
  for (const tag of tags.restorePoints()) {
    options.push({
      value: tag.name,
      label: `Before restore · ${formatCreatedAt(tag)}`
    });
  }

  return options;
}

function formatCreatedAt(
  tag: AssetTag
): string {
  return kDateFormat.format(new Date(tag.createdAt));
}

function describeError(
  error: unknown
): string {
  return error instanceof Error ? error.message : String(error);
}

customElements.define("jolly-editor-toolbar", EditorToolbar);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-editor-toolbar": EditorToolbar;
  }
}
