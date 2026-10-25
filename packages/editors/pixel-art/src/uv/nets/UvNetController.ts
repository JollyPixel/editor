// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import type {
  PixelArtCanvas,
  UVNet,
  UVRegion
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { renderIcon } from "../../shared/icons.ts";
import { UvNetLibrary } from "./UvNetLibrary.ts";
import type { UvNetPreset } from "./UvNetPreset.ts";
import type { UvNetDialog } from "./UvNetDialog.ts";

export interface UvNetControllerOptions {
  canvas: () => PixelArtCanvas | null;
  dialog: () => Promise<UvNetDialog>;
  adopt: (net: UVNet) => void;
}

export class UvNetController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #options: UvNetControllerOptions;
  #library = new UvNetLibrary();
  #release: (() => void) | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: UvNetControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get library(): UvNetLibrary {
    return this.#library;
  }

  set library(
    library: UvNetLibrary
  ) {
    if (library === this.#library) {
      return;
    }

    const connected = this.#release !== null;
    this.hostDisconnected();
    this.#library.document = null;
    this.#library = library;
    this.followActiveTexture();
    if (connected) {
      this.#release = library.subscribe("change", this.#onChange);
    }
    this.#onChange();
  }

  followActiveTexture(): void {
    this.#library.document = this.#options.canvas()?.document ?? null;
  }

  hostConnected(): void {
    this.#release ??= this.#library.subscribe("change", this.#onChange);
    this.#options.adopt(this.#library.default.net);
  }

  hostDisconnected(): void {
    this.#release?.();
    this.#release = null;
  }

  apply(
    regionId: string,
    preset: UvNetPreset
  ): boolean {
    return this.#options.canvas()?.uv.unfold(regionId, preset.net) ?? false;
  }

  renderMenu(
    regionId: string,
    region: Pick<UVRegion, "activeSlots">,
    close: () => void
  ): TemplateResult {
    const library = this.#library;

    return html`
      <div class="view-options-divider" role="separator"></div>
      <div class="uv-state-caption">Unfold with</div>
      ${[...library].map((preset) => {
        const missing = preset.net.missingSlots(region.activeSlots);
        const unfit = missing.length > 0;

        return html`
          <button
            class="uv-state-option"
            part="uv-net-option"
            role="menuitem"
            data-net=${preset.id}
            aria-disabled=${unfit ? "true" : nothing}
            title=${unfit ? `Missing slots: ${missing.join(", ")}` : nothing}
            @click=${() => {
              if (!unfit) {
                close();
                this.apply(regionId, preset);
              }
            }}
          >
            <span>${preset.name}</span>
            ${library.defaultId === preset.id ?
              html`<span class="uv-state-tag">default</span>` :
              nothing}
          </button>
        `;
      })}
      <div class="view-options-divider" role="separator"></div>
      <button
        class="uv-state-option"
        part="uv-net-edit-button"
        role="menuitem"
        @click=${() => {
          close();
          void this.openDialog();
        }}
      >
        ${renderIcon("edit")}
        <span>Edit nets</span>
      </button>
    `;
  }

  async openDialog(): Promise<void> {
    const uv = this.#options.canvas()?.uv;
    const regionId = uv?.selectedRegionId ?? null;
    const region = regionId === null ? null : uv?.get(regionId) ?? null;

    const dialog = await this.#options.dialog();
    await dialog.open({
      library: this.#library,
      region,
      apply: (preset) => {
        if (regionId !== null) {
          this.apply(regionId, preset);
        }
      }
    });
  }

  readonly #onChange = (): void => {
    this.#options.adopt(this.#library.default.net);
    this.#host.requestUpdate();
  };
}
