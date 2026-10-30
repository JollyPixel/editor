// Import Third-party Dependencies
import {
  css,
  html,
  LitElement,
  nothing,
  type PropertyValues,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import {
  POI_LOD_BIAS,
  POI_MIN_LEVEL,
  POI_PRIORITY,
  type PointOfInterestChanges,
  type PointOfInterestData,
  type TerrainDocument
} from "@jolly-pixel/asset.terrain/client";
import {
  readDetail,
  SubscriptionController,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/spin-slider";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/toggle";

// Import Internal Dependencies
import {
  TERRAIN_CAPABILITIES,
  type TerrainAccess
} from "../../../access/TerrainAccess.ts";
import type { PoiEditor } from "../model/PoiEditor.ts";
import type { PoiSelection } from "../model/PoiSelection.ts";
import "./poiIcons.ts";

export interface PoiPanelContext {
  document: Pick<TerrainDocument, "pointsOfInterest" | "subscribe">;
  editor: PoiEditor;
  selection: PoiSelection;
}

@customElement("terrain-poi-panel")
export class PoiPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-3, 12px);
      padding: var(--jolly-space-2, 8px);
      min-height: 100%;
      box-sizing: border-box;
      color: var(--jolly-text);
    }

    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .row {
      display: flex;
      justify-content: space-between;
      gap: var(--jolly-space-2, 8px);
      padding: 6px 8px;
      border: none;
      border-radius: 4px;
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .row:hover {
      background: var(--jolly-surface-hover, rgb(255 255 255 / 6%));
    }

    .row[aria-pressed="true"] {
      background: var(--jolly-accent-fill-muted, rgb(250 190 40 / 18%));
    }

    .count,
    .empty {
      color: var(--jolly-text-muted);
    }

    .details {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2, 8px);
    }

    .heading {
      display: flex;
      align-items: flex-end;
      gap: var(--jolly-space-2, 8px);
    }

    .heading jolly-text {
      flex: 1;
    }
  `;

  @property({ attribute: false })
  declare context: PoiPanelContext | null;

  @property({ attribute: false })
  declare access: TerrainAccess;

  #subscriptions = new SubscriptionController<PoiPanelContext | null>(
    this,
    (context) => (context === null ?
      [] :
      [
        context.document.subscribe("change", () => this.requestUpdate()),
        context.document.subscribe("reset", () => this.requestUpdate()),
        context.selection.subscribe("change", () => this.requestUpdate())
      ])
  );

  constructor() {
    super();
    this.context = null;
    this.access = TERRAIN_CAPABILITIES.full;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("context")) {
      this.#subscriptions.attach(this.context);
    }
  }

  override render(): TemplateResult | typeof nothing {
    const context = this.context;
    if (context === null) {
      return nothing;
    }

    const { document, editor, selection } = context;
    const points = document.pointsOfInterest.pointsOfInterest();
    const selected = selection.selected === null ?
      undefined :
      document.pointsOfInterest.pointOfInterest(selection.selected);

    return html`
      <jolly-button
        icon="poi-add"
        label="Add point of interest"
        data-action="add-poi"
        ?disabled=${!this.access.has("pointsOfInterest")}
        @click=${() => editor.add()}
      ></jolly-button>
      ${points.length === 0 ?
        html`<p class="empty">No points of interest yet: add one to keep a far landmark detailed.</p>` :
        html`
          <div class="list" role="listbox" aria-label="Points of interest">
            ${points.map((point) => html`
              <button
                class="row"
                role="option"
                data-poi=${point.id}
                aria-pressed=${String(point.id === selected?.id)}
                @click=${() => selection.select(point.id === selected?.id ? null : point.id)}
              >
                <span>${point.name || "Unnamed"}</span>
                <span class="count">${formatChunks(point.chunks.length)}</span>
              </button>
            `)}
          </div>
        `}
      ${selected === undefined ? nothing : this.#renderDetails(selected)}
    `;
  }

  #renderDetails(
    point: PointOfInterestData
  ): TemplateResult {
    const { editor, selection } = this.context!;

    return html`
      <div class="details" ?inert=${!this.access.has("pointsOfInterest")}>
        <div class="heading">
          <jolly-text
            label="Name"
            label-position="top"
            .value=${point.name}
            @jolly-change=${(event: Event) => this.#onChange(point.id, event, (name: string) => {
              return { name };
            })}
          ></jolly-text>
          <jolly-button
            icon="poi-remove"
            label="Remove point of interest"
            title="Remove point of interest"
            data-action="remove-poi"
            icon-only
            @click=${() => editor.remove(point.id)}
          ></jolly-button>
        </div>
        <jolly-toggle
          label="Edit chunks"
          data-field="edit-chunks"
          description="Click or drag on the terrain to add chunks, Ctrl+click to remove them."
          description-display="tooltip"
          .value=${selection.editing}
          @jolly-change=${(event: Event) => {
            const detail = readDetail<JollyChangeDetail<boolean>>(event);
            if (detail !== null) {
              selection.edit(detail.value);
            }
          }}
        ></jolly-toggle>
        <jolly-spin-slider
          label="LoD bias"
          data-field="lod-bias"
          description="Draws its chunks finer, as if they were this many times closer."
          description-display="tooltip"
          min=${POI_LOD_BIAS.min}
          max=${POI_LOD_BIAS.max}
          step="0.5"
          .value=${point.lodBias}
          @jolly-change=${(event: Event) => this.#onChange(point.id, event, (lodBias: number) => {
            return { lodBias };
          })}
        ></jolly-spin-slider>
        <jolly-spin-slider
          label="Minimum detail"
          data-field="min-level"
          description="Coarsest level kept at any distance: 0 draws 32 m nodes, 5 draws 1024 m nodes."
          description-display="tooltip"
          min=${POI_MIN_LEVEL.min}
          max=${POI_MIN_LEVEL.max}
          step="1"
          .value=${point.minLevel}
          @jolly-change=${(event: Event) => this.#onChange(point.id, event, (minLevel: number) => {
            return { minLevel };
          })}
        ></jolly-spin-slider>
        <jolly-spin-slider
          label="Priority"
          data-field="priority"
          description="Which points of interest load first when layers run short; the highest wins."
          description-display="tooltip"
          min=${POI_PRIORITY.min}
          max=${POI_PRIORITY.max}
          step="1"
          .value=${point.priority}
          @jolly-change=${(event: Event) => this.#onChange(point.id, event, (priority: number) => {
            return { priority };
          })}
        ></jolly-spin-slider>
      </div>
    `;
  }

  #onChange<TValue>(
    id: string,
    event: Event,
    changes: (value: TValue) => PointOfInterestChanges
  ): void {
    const detail = readDetail<JollyChangeDetail<TValue>>(event);
    if (detail !== null && !this.context!.editor.update(id, changes(detail.value))) {
      this.requestUpdate();
    }
  }
}

function formatChunks(
  count: number
): string {
  return count === 1 ? "1 chunk" : `${count} chunks`;
}

declare global {
  interface HTMLElementTagNameMap {
    "terrain-poi-panel": PoiPanel;
  }
}
