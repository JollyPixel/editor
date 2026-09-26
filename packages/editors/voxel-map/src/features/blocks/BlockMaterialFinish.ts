// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  nothing
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import type { VoxelEngine } from "@jolly-pixel/voxel.renderer";
import { FieldBinding } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/index.ts";
import type { LinkedTilesets } from "../tilesets/LinkedTilesets.ts";
import {
  customFinishSource,
  materialFinishSource,
  type MaterialGroupPort
} from "./materialGroupSources.ts";

// CONSTANTS
const kMetalHint = "Turn on Reflections in General to see metal";

export type MaterialGroupWriter = Pick<
  LinkedTilesets,
  "defineMaterialGroup" | "removeMaterialGroup"
>;

@customElement("block-material-finish")
export class BlockMaterialFinish extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }
  `;

  @property({ attribute: false })
  declare engine: VoxelEngine;

  @property({ attribute: false })
  declare tilesets: MaterialGroupWriter;

  @property({ attribute: false })
  declare mapDocument: MapDocumentSignals;

  @property({ attribute: false })
  declare groupId: string | undefined;

  #unwatch: (() => void) | null = null;

  #port: MaterialGroupPort = {
    groupId: () => this.groupId,
    group: () => (
      this.groupId === undefined ?
        undefined :
        this.engine.materialGroups.get(this.groupId)
    ),
    define: (group) => {
      this.tilesets.defineMaterialGroup(group);
    },
    remove: (groupId) => {
      this.tilesets.removeMaterialGroup(groupId);
    }
  };

  #custom = new FieldBinding(this, customFinishSource(this.#port));
  #roughness = new FieldBinding(
    this,
    materialFinishSource(this.#port, "roughness")
  );
  #metalness = new FieldBinding(
    this,
    materialFinishSource(this.#port, "metalness")
  );
  #emissive = new FieldBinding(
    this,
    materialFinishSource(this.#port, "emissive")
  );
  #emissiveIntensity = new FieldBinding(
    this,
    materialFinishSource(this.#port, "emissiveIntensity")
  );

  readonly #onMaterialGroupsChanged = (): void => {
    this.requestUpdate();
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.#watch();
  }

  override updated(
    changed: Map<string, unknown>
  ): void {
    if (changed.has("mapDocument")) {
      this.#watch();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#unwatch?.();
    this.#unwatch = null;
  }

  override render() {
    if (!this.engine || this.groupId === undefined) {
      return nothing;
    }

    return html`
      <jolly-checkbox
        align="end"
        label="Finish"
        description="Saves a finish with the tileset for the whole group"
        .value=${this.#custom.value}
        @jolly-change=${this.#custom.commit}
      ></jolly-checkbox>
      ${this.#custom.value ? this.#renderFinish() : nothing}
    `;
  }

  #watch(): void {
    this.#unwatch?.();
    this.#unwatch = this.isConnected && this.mapDocument ?
      this.mapDocument.subscribe(
        "materialGroupsChanged",
        this.#onMaterialGroupsChanged
      ) :
      null;
  }

  #renderFinish() {
    return html`
      <jolly-slider
        label="Roughness"
        min="0"
        max="1"
        step="0.05"
        .value=${this.#roughness.value}
        @jolly-input=${this.#roughness.input}
        @jolly-change=${this.#roughness.commit}
      ></jolly-slider>
      <jolly-slider
        label="Metalness"
        description=${this.#metalness.value > 0 ? kMetalHint : ""}
        min="0"
        max="1"
        step="0.05"
        .value=${this.#metalness.value}
        @jolly-input=${this.#metalness.input}
        @jolly-change=${this.#metalness.commit}
      ></jolly-slider>
      <jolly-color
        label="Emissive"
        .value=${this.#emissive.value}
        @jolly-input=${this.#emissive.input}
        @jolly-change=${this.#emissive.commit}
      ></jolly-color>
      <jolly-number
        label="Glow"
        description="Emissive intensity"
        min="0"
        step="0.1"
        .value=${this.#emissiveIntensity.value}
        @jolly-input=${this.#emissiveIntensity.input}
        @jolly-change=${this.#emissiveIntensity.commit}
      ></jolly-number>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "block-material-finish": BlockMaterialFinish;
  }
}
