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
import {
  FieldBinding,
  type FieldSource
} from "@jolly-pixel/ui";
import {
  MaterialGroup,
  MAX_LIGHT_LEVEL,
  type MaterialGroupFinish
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { MapMaterial } from "./MapMaterial.ts";
import type { MapMaterials } from "./MapMaterials.ts";

// CONSTANTS
const kMetalHint = "Turn on Reflections in General to see metal";

@customElement("material-finish")
export class MaterialFinish extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }
  `;

  @property({ attribute: false })
  declare materials: Pick<MapMaterials, "refinish">;

  @property({ attribute: false })
  declare material: MapMaterial | undefined;

  @property({ type: Boolean })
  declare disabled: boolean;

  #roughness = new FieldBinding(this, this.#source("roughness"));
  #metalness = new FieldBinding(this, this.#source("metalness"));
  #emissive = new FieldBinding(this, this.#source("emissive"));
  #emissiveIntensity = new FieldBinding(
    this,
    this.#source("emissiveIntensity")
  );
  #normalScale = new FieldBinding(this, this.#source("normalScale"));
  #lightLevel = new FieldBinding(this, this.#source("lightLevel"));

  constructor() {
    super();
    this.disabled = false;
  }

  override render() {
    if (this.material === undefined) {
      return nothing;
    }

    return html`
      <jolly-slider
        label="Roughness"
        label-position="auto"
        min="0"
        max="1"
        step="0.05"
        ?disabled=${this.disabled}
        .value=${this.#roughness.value}
        @jolly-input=${this.#roughness.input}
        @jolly-change=${this.#roughness.commit}
      ></jolly-slider>
      <jolly-slider
        label="Metalness"
        label-position="auto"
        description=${this.#metalness.value > 0 ? kMetalHint : ""}
        description-display="tooltip"
        min="0"
        max="1"
        step="0.05"
        ?disabled=${this.disabled}
        .value=${this.#metalness.value}
        @jolly-input=${this.#metalness.input}
        @jolly-change=${this.#metalness.commit}
      ></jolly-slider>
      <jolly-color
        label="Emissive"
        label-position="auto"
        ?disabled=${this.disabled}
        .value=${this.#emissive.value}
        @jolly-input=${this.#emissive.input}
        @jolly-change=${this.#emissive.commit}
      ></jolly-color>
      <jolly-number
        label="Glow"
        label-position="auto"
        description="Emissive intensity"
        description-display="tooltip"
        min="0"
        step="0.1"
        ?disabled=${this.disabled}
        .value=${this.#emissiveIntensity.value}
        @jolly-input=${this.#emissiveIntensity.input}
        @jolly-change=${this.#emissiveIntensity.commit}
      ></jolly-number>
      <jolly-slider
        label="Light level"
        label-position="auto"
        description="Lights nearby blocks in the emissive colour, 0 turns it off"
        description-display="tooltip"
        min="0"
        max=${MAX_LIGHT_LEVEL}
        step="1"
        ?disabled=${this.disabled}
        .value=${this.#lightLevel.value}
        @jolly-input=${this.#lightLevel.input}
        @jolly-change=${this.#lightLevel.commit}
      ></jolly-slider>
      <jolly-slider
        label="Normal strength"
        label-position="auto"
        description="Relief from the blockset normal map, 0 turns it off"
        description-display="tooltip"
        min="0"
        max="3"
        step="0.1"
        ?disabled=${this.disabled}
        .value=${this.#normalScale.value}
        @jolly-input=${this.#normalScale.input}
        @jolly-change=${this.#normalScale.commit}
      ></jolly-slider>
    `;
  }

  #source<TField extends keyof MaterialGroupFinish>(
    field: TField
  ): FieldSource<MaterialGroupFinish[TField]> {
    return {
      read: () => (this.material?.finish ?? MaterialGroup.defaults)[field],
      write: (value) => {
        if (this.material === undefined) {
          return;
        }

        const finish: Partial<MaterialGroupFinish> = {};
        finish[field] = value;
        this.materials.refinish(this.material, finish);
      }
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "material-finish": MaterialFinish;
  }
}
