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
import "@jolly-pixel/editor.host/ui";

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
  { label: "Daylight", value: "daylight" }
];

@customElement("map-config-panel")
export class MapConfigPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    jolly-archive-actions {
      padding-inline-end: var(--jolly-field-inset-end, var(--jolly-space-1, 4px));
    }
  `;

  @property({ attribute: false })
  declare workspace: VoxelMapWorkspace;

  #gridVisible = new FieldBinding<boolean>(this, {
    read: () => this.workspace.grid.enabled,
    write: (value) => {
      this.workspace.grid.enabled = value;
    }
  });

  #lighting = this.#viewBinding("lighting");
  #reflections = this.#viewBinding("reflections");
  #ambientOcclusion = this.#viewBinding("ambientOcclusion");
  #shadows = this.#viewBinding("shadows");

  #skyRadius = new FieldBinding<number>(this, {
    read: () => this.workspace.localBrush.skyRadius,
    write: (value) => {
      this.workspace.localBrush.skyRadius = value;
    }
  });

  override render() {
    return html`
      <jolly-checkbox
        align="end"
        label="Grid visibility"
        .value=${this.#gridVisible.value}
        @jolly-change=${this.#gridVisible.commit}
      ></jolly-checkbox>

      <jolly-slider
        label="Sky radius"
        min="0"
        max="32"
        step="1"
        .value=${this.#skyRadius.value}
        @jolly-input=${this.#skyRadius.input}
        @jolly-change=${this.#skyRadius.commit}
      ></jolly-slider>

      ${this.#renderView()}
      <jolly-separator label="File"></jolly-separator>
      <jolly-archive-actions
        .archives=${this.workspace.archives}
      ></jolly-archive-actions>
    `;
  }

  #renderView() {
    return html`
      <jolly-separator label="View"></jolly-separator>
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
        .value=${this.#reflections.value}
        @jolly-change=${this.#reflections.commit}
      ></jolly-checkbox>
      <jolly-checkbox
        align="end"
        label="Occlusion"
        description="Darkens corners; rebuilds every chunk"
        .value=${this.#ambientOcclusion.value}
        @jolly-change=${this.#ambientOcclusion.commit}
      ></jolly-checkbox>
      <jolly-checkbox
        align="end"
        label="Shadows"
        description="Sun shadows around the camera"
        .value=${this.#shadows.value}
        @jolly-change=${this.#shadows.commit}
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
