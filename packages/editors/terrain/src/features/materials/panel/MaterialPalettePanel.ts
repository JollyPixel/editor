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
  state
} from "lit/decorators.js";
import {
  TERRAIN_MATERIAL_MAPS,
  TERRAIN_TEXTURE_SIZES,
  type TerrainDocument,
  type TerrainMaterialData,
  type TerrainMaterialMapKind,
  type TerrainTextureSize
} from "@jolly-pixel/asset.terrain/client";
import { splatOverlayColor } from "@jolly-pixel/terrain.renderer";
import {
  readDetail,
  SubscriptionController,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/property-row";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/spin-slider";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/toggle";

// Import Internal Dependencies
import type {
  MaterialPalette,
  MaterialTechnique,
  TextureFile
} from "../model/MaterialPalette.ts";
import type { MaterialSelection } from "../model/MaterialSelection.ts";
import type { MaterialThumbnails } from "../model/MaterialThumbnails.ts";
import type { OverlaySettings } from "../../overlays/model/OverlaySettings.ts";
import "./materialIcons.ts";

// CONSTANTS
const kImageExtensions = /\.(png|jpe?g|webp)$/i;
const kMapLabels: Readonly<Record<TerrainMaterialMapKind, {
  label: string;
  badge: string;
  description: string;
}>> = {
  albedo: {
    label: "Color",
    badge: "A",
    description: "Albedo: the surface colour, without lighting."
  },
  normal: {
    label: "Bumps",
    badge: "N",
    description: "Normal map: small bumps and grooves that catch the light."
  },
  orm: {
    label: "Surface",
    badge: "O",
    description: "ORM map: ambient occlusion, roughness and metalness in the red, green and blue channels."
  },
  height: {
    label: "Height",
    badge: "H",
    description: "Height map: the relief, used to blend materials along it."
  }
};
const kTechniques: readonly {
  technique: MaterialTechnique;
  label: string;
  description: string;
}[] = [
  {
    technique: "triplanar",
    label: "Wrap steep slopes",
    description: "Triplanar: projects the texture from three sides so cliffs do not stretch."
  },
  {
    technique: "stochastic",
    label: "Hide repetition",
    description: "Stochastic tiling: shuffles each repeat so the pattern does not show."
  },
  {
    technique: "heightBlend",
    label: "Blend by height",
    description: "Height blending: blends with neighbours along the height map, like sand between stones."
  }
];

export interface MaterialPaletteContext {
  document: Pick<TerrainDocument, "materials" | "subscribe">;
  palette: MaterialPalette;
  selection: MaterialSelection;
  thumbnails: MaterialThumbnails;
  overlay: Pick<OverlaySettings, "options" | "subscribe">;
}

@customElement("terrain-material-palette")
export class MaterialPalettePanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-3, 12px);
      padding: var(--jolly-space-2, 8px);
      min-height: 100%;
      box-sizing: border-box;
      color: var(--jolly-text);

      --fallback-albedo: #adb69c;
    }

    :host([dropping]) {
      outline: 2px dashed var(--jolly-accent-fill);
      outline-offset: -4px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
      gap: var(--jolly-space-2, 8px);
    }

    .swatch {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: center;
    }

    .tile {
      position: relative;
      aspect-ratio: 1;
      border-radius: var(--jolly-radius-md, 4px);
      background: var(--fallback-albedo);
      background-size: cover;
      background-position: center;
      box-shadow: inset 0 0 0 1px var(--jolly-border);
    }

    .swatch[aria-pressed="true"] .tile {
      box-shadow: 0 0 0 2px var(--jolly-accent-fill);
    }

    .swatch:focus-visible .tile {
      outline: 2px solid var(--jolly-focus-ring);
      outline-offset: 2px;
    }

    .splat {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      box-shadow: 0 0 0 2px var(--jolly-surface-raised);
    }

    .badges {
      position: absolute;
      right: 3px;
      bottom: 3px;
      display: flex;
      gap: 2px;
    }

    .badge {
      min-width: 13px;
      padding: 0 2px;
      border-radius: 2px;
      background: var(--jolly-surface-raised);
      color: var(--jolly-text-muted);
      font-size: 9px;
      line-height: 13px;
    }

    .name {
      overflow: hidden;
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .add .tile {
      background: var(--jolly-surface-sunken);
      display: grid;
      place-items: center;
      color: var(--jolly-text-muted);
      font-size: 24px;
    }

    .hint {
      color: var(--jolly-text-muted);
      font-size: 11px;
    }

    .details {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-space-2, 8px);
    }

    .heading {
      display: flex;
      gap: var(--jolly-space-2, 8px);
      align-items: center;
    }

    .preview {
      flex: none;
      width: 72px;
      aspect-ratio: 1;
      border-radius: var(--jolly-radius-md, 4px);
      background: var(--fallback-albedo);
      background-size: cover;
      background-position: center;
    }

    .heading jolly-text {
      flex: 1 1 auto;
    }

    .map {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .map-tile {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px dashed var(--jolly-border-strong);
      border-radius: var(--jolly-radius-sm, 2px);
      background: var(--jolly-surface-sunken);
      background-size: cover;
      background-position: center;
      cursor: pointer;
    }

    .map-tile.filled {
      border-style: solid;
    }
  `;

  @property({ attribute: false })
  declare context: MaterialPaletteContext | null;

  @property({ type: Boolean, reflect: true })
  declare dropping: boolean;

  @state()
  declare private busy: boolean;

  #subscriptions = new SubscriptionController<MaterialPaletteContext | null>(
    this,
    (context) => (context === null ?
      [] :
      [
        context.document.subscribe("change", () => this.requestUpdate()),
        context.document.subscribe("reset", () => this.requestUpdate()),
        context.selection.subscribe("change", () => this.requestUpdate()),
        context.thumbnails.subscribe("change", () => this.requestUpdate()),
        context.overlay.subscribe("change", () => this.requestUpdate())
      ])
  );

  constructor() {
    super();
    this.context = null;
    this.dropping = false;
    this.busy = false;
    this.addEventListener("dragover", this.#onDragOver);
    this.addEventListener("dragleave", () => {
      this.dropping = false;
    });
    this.addEventListener("drop", this.#onDropPalette);
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

    const { document, selection } = context;
    const materials = document.materials.materials();
    const selected = materials.find(({ id }) => id === selection.selected);

    return html`
      <jolly-select
        label="Texture size"
        .options=${TERRAIN_TEXTURE_SIZES.map((size) => {
          return { value: size, label: `${size} px` };
        })}
        .value=${document.materials.textureSize}
        @jolly-change=${this.#onTextureSize}
      ></jolly-select>
      <div class="grid" role="listbox" aria-label="Materials">
        ${materials.map((material) => this.#renderSwatch(material, material.id === selection.selected))}
        <button
          class="swatch add"
          title="Add a material from a texture"
          ?disabled=${this.busy}
          @click=${() => this.#run(() => context.palette.addFromPicker())}
        >
          <div class="tile">+</div>
          <span class="name">Add</span>
        </button>
      </div>
      <span class="hint">Drop images here to add materials.</span>
      ${selected === undefined ? nothing : this.#renderDetails(selected)}
    `;
  }

  #renderSwatch(
    material: TerrainMaterialData,
    selected: boolean
  ): TemplateResult {
    const { thumbnails, overlay } = this.context!;
    const albedo = thumbnails.url(material.albedo?.id);
    const painted = overlay.options.overlay === "splat" ?
      `rgb(${splatOverlayColor(material.slot).map((channel) => Math.round(channel * 255)).join(" ")})` :
      null;

    return html`
      <button
        class="swatch"
        role="option"
        aria-pressed=${selected ? "true" : "false"}
        aria-selected=${selected ? "true" : "false"}
        title=${material.name}
        @click=${() => this.context!.selection.select(material.id)}
      >
        <div class="tile" style=${albedo === null ? "" : `background-image: url(${albedo})`}>
          ${painted === null ? nothing : html`
            <span
              class="splat"
              style=${`background: ${painted}`}
              title="Colour in the Painted materials overlay"
            ></span>
          `}
          <div class="badges">
            ${TERRAIN_MATERIAL_MAPS
              .filter((map) => material[map] !== null)
              .map((map) => html`<span class="badge">${kMapLabels[map].badge}</span>`)}
          </div>
        </div>
        <span class="name">${material.name}</span>
      </button>
    `;
  }

  #renderDetails(
    material: TerrainMaterialData
  ): TemplateResult {
    const { palette, thumbnails } = this.context!;
    const albedo = thumbnails.url(material.albedo?.id);
    const filled = TERRAIN_MATERIAL_MAPS.filter((map) => material[map] !== null);
    const techniques = kTechniques.filter(({ technique }) => material[technique]);

    return html`
      <div class="details">
        <div class="heading">
          <div class="preview" style=${albedo === null ? "" : `background-image: url(${albedo})`}></div>
          <jolly-text
            label="Name"
            label-position="top"
            .value=${material.name}
            @jolly-change=${(event: Event) => this.#onRename(material.id, event)}
          ></jolly-text>
          <jolly-button
            icon="material-remove"
            label="Remove material"
            title="Remove material"
            icon-only
            @click=${() => palette.remove(material.id)}
          ></jolly-button>
        </div>
        <jolly-spin-slider
          label="Scale"
          description="Metres covered by one repeat of the texture (tiling)."
          description-display="tooltip"
          min="0.25"
          max="64"
          step="0.25"
          .value=${material.tiling}
          @jolly-change=${(event: Event) => this.#onScale(material.id, event)}
        ></jolly-spin-slider>
        <jolly-folder
          key="material-maps"
          label=${`Maps (${filled.map((map) => kMapLabels[map].badge).join(" ") || "none"})`}
          .open=${false}
        >
          ${TERRAIN_MATERIAL_MAPS.map((map) => this.#renderMap(material, map))}
        </jolly-folder>
        <jolly-folder
          key="material-look"
          label=${`Look (${techniques.length === 0 ? "none" : techniques.length})`}
          .open=${false}
        >
          ${kTechniques.map(({ technique, label, description }) => html`
            <jolly-toggle
              label=${label}
              description=${description}
              description-display="tooltip"
              .value=${material[technique]}
              @jolly-change=${(event: Event) => this.#onTechnique(material.id, technique, event)}
            ></jolly-toggle>
          `)}
        </jolly-folder>
      </div>
    `;
  }

  #renderMap(
    material: TerrainMaterialData,
    map: TerrainMaterialMapKind
  ): TemplateResult {
    const { palette, thumbnails } = this.context!;
    const { label, description } = kMapLabels[map];
    const reference = material[map];
    const url = thumbnails.url(reference?.id);
    const name = label.toLowerCase();
    const hint = reference === null ?
      `Pick or drop a ${name} texture` :
      `Replace the ${name} texture`;

    return html`
      <jolly-property-row label=${label} description=${description} description-display="tooltip">
        <div class="map">
          <button
            class=${reference === null ? "map-tile" : "map-tile filled"}
            style=${url === null ? "" : `background-image: url(${url})`}
            title=${hint}
            @click=${() => this.#run(() => palette.pickMap(material.id, map))}
            @dragover=${this.#onDragOver}
            @drop=${(event: DragEvent) => this.#onDropMap(event, material.id, map)}
          ></button>
          ${reference === null ? nothing : html`
            <jolly-button
              icon="close"
              label=${`Clear the ${name} texture`}
              title=${`Clear the ${name} texture`}
              icon-only
              @click=${() => palette.clearMap(material.id, map)}
            ></jolly-button>
          `}
        </div>
      </jolly-property-row>
    `;
  }

  #onTextureSize = (
    event: Event
  ): void => {
    const detail = readDetail<JollyChangeDetail<TerrainTextureSize>>(event);
    if (detail !== null) {
      this.context?.palette.changeTextureSize(detail.value);
    }
  };

  #onRename(
    materialId: string,
    event: Event
  ): void {
    const detail = readDetail<JollyChangeDetail<string>>(event);
    if (detail !== null && !this.context!.palette.rename(materialId, detail.value)) {
      this.requestUpdate();
    }
  }

  #onScale(
    materialId: string,
    event: Event
  ): void {
    const detail = readDetail<JollyChangeDetail<number>>(event);
    if (detail !== null) {
      this.context!.palette.scale(materialId, detail.value);
    }
  }

  #onTechnique(
    materialId: string,
    technique: MaterialTechnique,
    event: Event
  ): void {
    const detail = readDetail<JollyChangeDetail<boolean>>(event);
    if (detail !== null) {
      this.context!.palette.technique(materialId, technique, detail.value);
    }
  }

  #onDragOver = (
    event: DragEvent
  ): void => {
    if (event.dataTransfer?.types.includes("Files")) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      this.dropping = true;
    }
  };

  #onDropPalette = (
    event: DragEvent
  ): void => {
    this.dropping = false;
    if (event.defaultPrevented || this.context === null) {
      return;
    }

    event.preventDefault();
    const { palette } = this.context;
    void this.#run(async() => palette.addFromFiles(await droppedImages(event)));
  };

  #onDropMap(
    event: DragEvent,
    materialId: string,
    map: TerrainMaterialMapKind
  ): void {
    event.preventDefault();
    this.dropping = false;
    const { palette } = this.context!;
    void this.#run(async() => {
      const [file] = await droppedImages(event);
      if (file !== undefined) {
        await palette.dropMap(materialId, map, file);
      }
    });
  }

  async #run(
    action: () => Promise<unknown>
  ): Promise<void> {
    this.busy = true;
    try {
      await action();
    }
    catch (error) {
      console.warn("[terrain] The material change failed.", error);
    }
    finally {
      this.busy = false;
    }
  }
}

async function droppedImages(
  event: DragEvent
): Promise<TextureFile[]> {
  const files = Array.from(event.dataTransfer?.files ?? [])
    .filter((file) => kImageExtensions.test(file.name));

  return Promise.all(files.map(async(file) => {
    return {
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer())
    };
  }));
}

declare global {
  interface HTMLElementTagNameMap {
    "terrain-material-palette": MaterialPalettePanel;
  }
}
