// Import Third-party Dependencies
import {
  LitElement,
  html,
  css
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import {
  FieldBinding,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import type {
  LightingMode,
  ViewSettingsJSON
} from "../../state/index.ts";

// CONSTANTS
const kLightingOptions: JollyOption<LightingMode>[] = [
  { label: "Flat", value: "flat" },
  { label: "Studio", value: "studio" },
  { label: "Daylight", value: "daylight" },
  { label: "Night", value: "night" }
];

@customElement("map-config-panel")
export class MapConfigPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }
  `;

  @property({ attribute: false })
  declare workspace: VoxelMapWorkspace;

  #lighting = this.#viewBinding("lighting");
  #reflections = this.#viewBinding("reflections");
  #ambientOcclusion = this.#viewBinding("ambientOcclusion");
  #shadows = this.#viewBinding("shadows");
  #blockLight = this.#viewBinding("blockLight");
  #glow = this.#viewBinding("glow");

  override render() {
    return html`
      <jolly-select
        label="Lighting"
        .options=${kLightingOptions}
        .value=${this.#lighting.value}
        @jolly-change=${this.#lighting.commit}
      ></jolly-select>
      <jolly-checkbox
        align="end"
        label="Reflections"
        description="Shows the metal and roughness of material groups"
        description-display="tooltip"
        .value=${this.#reflections.value}
        @jolly-change=${this.#reflections.commit}
      ></jolly-checkbox>
      <jolly-checkbox
        align="end"
        label="Occlusion"
        description="Darkens corners; rebuilds every chunk"
        description-display="tooltip"
        .value=${this.#ambientOcclusion.value}
        @jolly-change=${this.#ambientOcclusion.commit}
      ></jolly-checkbox>
      <jolly-checkbox
        align="end"
        label="Shadows"
        description="Sun shadows around the camera"
        description-display="tooltip"
        .value=${this.#shadows.value}
        @jolly-change=${this.#shadows.commit}
      ></jolly-checkbox>
      <jolly-checkbox
        align="end"
        label="Block light"
        description="Glowing materials light the blocks around them"
        description-display="tooltip"
        .value=${this.#blockLight.value}
        @jolly-change=${this.#blockLight.commit}
      ></jolly-checkbox>
      <jolly-checkbox
        align="end"
        label="Glow"
        description="Glowing materials bloom on screen"
        description-display="tooltip"
        .value=${this.#glow.value}
        @jolly-change=${this.#glow.commit}
      ></jolly-checkbox>
    `;
  }

  #viewBinding<TKey extends keyof ViewSettingsJSON>(
    key: TKey
  ): FieldBinding<ViewSettingsJSON[TKey]> {
    return new FieldBinding<ViewSettingsJSON[TKey]>(this, {
      read: () => this.workspace.state.view.settings[key],
      write: (value) => {
        const patch: Partial<ViewSettingsJSON> = {};
        patch[key] = value;
        this.workspace.state.view.update(patch);
      }
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "map-config-panel": MapConfigPanel;
  }
}
