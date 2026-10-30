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
  property,
  query,
  state
} from "lit/decorators.js";
import type { TerrainDocument } from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_TIERS,
  HEIGHT_RANGE,
  InvalidImageError,
  type ChunkRect,
  type ChunkTier,
  type HeightRange
} from "@jolly-pixel/terrain.renderer";
import {
  readDetail,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/select";

// Import Internal Dependencies
import type {
  ChosenHeightmap,
  ChosenMask,
  ExchangeFile,
  HeightmapFormat,
  TerrainExchange
} from "../model/TerrainExchange.ts";
import "./exchangeIcons.ts";

// CONSTANTS
const kHeightmapAccept = ".png,.raw,.r16,.json";
const kMaskAccept = ".png";

export interface ExchangePanelContext {
  document: Pick<TerrainDocument, "materials">;
  exchange: TerrainExchange;
  download(file: ExchangeFile): void;
}

@customElement("terrain-exchange-panel")
export class ExchangePanel extends LitElement {
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

    section {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2, 8px);
    }

    h3 {
      margin: 0;
      font-size: inherit;
    }

    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--jolly-space-2, 8px);
    }

    .status {
      margin: 0;
      color: var(--jolly-text-muted);
    }

    .status[data-failed] {
      color: var(--jolly-danger, #f26d6d);
    }

    input[type="file"] {
      display: none;
    }
  `;

  @property({ attribute: false })
  declare context: ExchangePanelContext | null;

  @state()
  declare private rect: ChunkRect;

  @state()
  declare private tier: ChunkTier;

  @state()
  declare private format: HeightmapFormat;

  @state()
  declare private range: HeightRange;

  @state()
  declare private heightmap: ChosenHeightmap | null;

  @state()
  declare private masks: readonly ChosenMask[];

  @state()
  declare private busy: boolean;

  @state()
  declare private status: { readonly text: string; readonly failed: boolean; } | null;

  @query("input[data-input=heightmap]")
  declare private heightmapInput: HTMLInputElement;

  @query("input[data-input=masks]")
  declare private maskInput: HTMLInputElement;

  constructor() {
    super();
    this.context = null;
    this.rect = { x: 0, z: 0, columns: 1, rows: 1 };
    this.tier = 1;
    this.format = "png";
    this.range = { min: 0, max: 100 };
    this.heightmap = null;
    this.masks = [];
    this.busy = false;
    this.status = null;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    if (changed.has("context") && this.context !== null) {
      this.rect = this.context.exchange.wholeRect();
    }
  }

  override render(): TemplateResult | typeof nothing {
    if (this.context === null) {
      return nothing;
    }

    return html`
      ${this.#renderRect()}
      ${this.#renderHeightmap()}
      ${this.#renderSplat()}
      ${this.status === null ?
        nothing :
        html`<p class="status" role="status" ?data-failed=${this.status.failed}>${this.status.text}</p>`}
    `;
  }

  #renderRect(): TemplateResult {
    const { x, z, columns, rows } = this.rect;

    return html`
      <section>
        <h3>Chunks</h3>
        <div class="row">
          ${this.#rectField("West chunk", "x", x)}
          ${this.#rectField("South chunk", "z", z)}
          ${this.#rectField("Columns", "columns", columns, 1)}
          ${this.#rectField("Rows", "rows", rows, 1)}
        </div>
        <jolly-button
          label="Whole terrain"
          data-action="whole-terrain"
          @click=${() => {
            this.rect = this.context!.exchange.wholeRect();
          }}
        ></jolly-button>
      </section>
    `;
  }

  #rectField(
    label: string,
    field: keyof ChunkRect,
    value: number,
    min?: number
  ): TemplateResult {
    return html`
      <jolly-number
        label=${label}
        data-field=${field}
        min=${min ?? nothing}
        .value=${value}
        @jolly-change=${(event: Event) => {
          const detail = readDetail<JollyChangeDetail<number>>(event);
          if (detail !== null) {
            this.rect = { ...this.rect, [field]: detail.value };
          }
        }}
      ></jolly-number>
    `;
  }

  #renderHeightmap(): TemplateResult {
    const { heightmap, range, busy } = this;
    const size = heightmap?.image;

    return html`
      <section>
        <h3>Heightmap</h3>
        <div class="row">
          <jolly-select
            label="Detail"
            data-field="tier"
            .options=${CHUNK_TIERS.map((tier) => {
              return { value: tier, label: `×${tier}, ${1 / tier} m` };
            })}
            .value=${this.tier}
            @jolly-change=${(event: Event) => {
              const detail = readDetail<JollyChangeDetail<ChunkTier>>(event);
              if (detail !== null) {
                this.tier = detail.value;
              }
            }}
          ></jolly-select>
          <jolly-select
            label="Format"
            data-field="format"
            .options=${[{ value: "png", label: "16-bit PNG" }, { value: "raw", label: "RAW" }]}
            .value=${this.format}
            @jolly-change=${(event: Event) => {
              const detail = readDetail<JollyChangeDetail<HeightmapFormat>>(event);
              if (detail !== null) {
                this.format = detail.value;
              }
            }}
          ></jolly-select>
          ${this.#rangeField("Lowest height", "min", range.min)}
          ${this.#rangeField("Highest height", "max", range.max)}
        </div>
        <jolly-button
          label="Export heightmap"
          data-action="export-heightmap"
          ?disabled=${busy}
          @click=${this.#exportHeightmap}
        ></jolly-button>
        <jolly-button
          label="Choose heightmap"
          data-action="choose-heightmap"
          ?disabled=${busy}
          @click=${() => this.heightmapInput.click()}
        ></jolly-button>
        <input
          type="file"
          multiple
          data-input="heightmap"
          accept=${kHeightmapAccept}
          @change=${this.#onHeightmapChosen}
        />
        ${size === undefined ?
          nothing :
          html`
            <p class="status">${size.width}×${size.height} px, ${size.depth}-bit</p>
            <jolly-button
              label="Import heightmap"
              data-action="import-heightmap"
              variant="accent"
              ?disabled=${busy}
              @click=${this.#importHeightmap}
            ></jolly-button>
          `}
      </section>
    `;
  }

  #rangeField(
    label: string,
    field: keyof HeightRange,
    value: number
  ): TemplateResult {
    return html`
      <jolly-number
        label=${label}
        data-field=${field}
        step="0.1"
        min=${HEIGHT_RANGE.min}
        max=${HEIGHT_RANGE.max}
        .value=${value}
        @jolly-change=${(event: Event) => {
          const detail = readDetail<JollyChangeDetail<number>>(event);
          if (detail !== null) {
            this.range = { ...this.range, [field]: detail.value };
          }
        }}
      ></jolly-number>
    `;
  }

  #renderSplat(): TemplateResult {
    const { masks, busy } = this;
    const materials = this.context!.document.materials.materials().map(({ slot, name }) => {
      return { value: slot, label: name };
    });
    const unmatched = masks.some(({ slot }) => slot === null);

    return html`
      <section>
        <h3>Splat map</h3>
        <jolly-button
          label="Export splat map"
          data-action="export-splat"
          ?disabled=${busy}
          @click=${this.#exportSplat}
        ></jolly-button>
        <jolly-button
          label="Choose masks"
          data-action="choose-masks"
          ?disabled=${busy}
          @click=${() => this.maskInput.click()}
        ></jolly-button>
        <input
          type="file"
          multiple
          data-input="masks"
          accept=${kMaskAccept}
          @change=${this.#onMasksChosen}
        />
        ${masks.map((mask, index) => html`
          <jolly-select
            label=${mask.name}
            data-mask=${mask.name}
            .options=${materials}
            .value=${mask.slot}
            @jolly-change=${(event: Event) => {
              const detail = readDetail<JollyChangeDetail<number>>(event);
              if (detail !== null) {
                this.masks = this.masks.with(index, { ...mask, slot: detail.value });
              }
            }}
          ></jolly-select>
        `)}
        ${masks.length === 0 ?
          nothing :
          html`
            <jolly-button
              label="Import splat map"
              data-action="import-splat"
              variant="accent"
              ?disabled=${busy || unmatched}
              @click=${this.#importSplat}
            ></jolly-button>
          `}
      </section>
    `;
  }

  #exportHeightmap = (): Promise<void> => this.#run(async() => {
    const { exchange, download } = this.context!;
    const files = await exchange.exportHeightmap(this.rect, this.tier, this.format);
    files.forEach(download);

    return `Saved ${files[0].name} and its sidecar.`;
  });

  #exportSplat = (): Promise<void> => this.#run(async() => {
    const { exchange, download } = this.context!;
    const files = await exchange.exportSplat(this.rect);
    files.forEach(download);

    return files.length === 1 ? "Saved 1 mask." : `Saved ${files.length} masks.`;
  });

  #onHeightmapChosen = (): Promise<void> => this.#run(async() => {
    const chosen = await this.context!.exchange.chooseHeightmap(await readFiles(this.heightmapInput));
    this.heightmap = chosen;
    if (chosen.sidecar !== null) {
      const { min, max, tier, rect } = chosen.sidecar;
      this.range = { min, max };
      this.tier = tier;
      this.rect = rect;
    }

    return "Check the rectangle and the heights, then import.";
  });

  #onMasksChosen = (): Promise<void> => this.#run(async() => {
    this.masks = await this.context!.exchange.chooseMasks(await readFiles(this.maskInput));

    return "Pick a material for each mask, then import.";
  });

  #importHeightmap = (): Promise<void> => this.#run(async() => {
    const { exchange } = this.context!;
    const refusal = exchange.refusal(this.rect);
    if (refusal !== null) {
      throw new InvalidImageError(refusal);
    }
    if (this.range.min >= this.range.max) {
      throw new InvalidImageError("The lowest height must be under the highest.");
    }

    await exchange.importHeightmap(this.heightmap!.image, this.rect, this.tier, this.range);
    this.heightmap = null;

    return "Heightmap imported.";
  });

  #importSplat = (): Promise<void> => this.#run(async() => {
    const masks = this.masks.flatMap(({ slot, image }) => (slot === null ? [] : [{ slot, image }]));
    await this.context!.exchange.importSplat(this.rect, masks);
    this.masks = [];

    return "Splat map imported.";
  });

  async #run(
    work: () => Promise<string>
  ): Promise<void> {
    this.busy = true;
    this.status = { text: "Working…", failed: false };
    try {
      this.status = { text: await work(), failed: false };
    }
    catch (error) {
      if (!(error instanceof InvalidImageError)) {
        console.error("[terrain] Import or export failed.", error);
      }
      const text = error instanceof InvalidImageError ?
        error.message :
        "Import or export failed; see the console.";
      this.status = { text, failed: true };
    }
    finally {
      this.busy = false;
      this.heightmapInput.value = "";
      this.maskInput.value = "";
    }
  }
}

function readFiles(
  input: HTMLInputElement
): Promise<ExchangeFile[]> {
  return Promise.all(Array.from(input.files ?? [], async(file) => {
    return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) };
  }));
}

declare global {
  interface HTMLElementTagNameMap {
    "terrain-exchange-panel": ExchangePanel;
  }
}
