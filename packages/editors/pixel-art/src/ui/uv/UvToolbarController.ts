// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import { classMap } from "lit/directives/class-map.js";
import type {
  PixelArtCanvas,
  UVFace,
  UVRegionState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { renderIcon } from "../common/icons.ts";

// UV "Create" button uses this preset size.
const kUvCreateSize = {
  width: 16,
  height: 16
};

interface UvVisibilityChangedDetail {
  showAll: boolean;
}

/**
 * UV toolbar state (selection, region state, visibility).
 * Syncs with PixelArtCanvas.uv; host renders toolbar only.
 */
export class UvToolbarController implements ReactiveController {
  #host: ReactiveControllerHost;
  #canvas: PixelArtCanvas | null = null;

  #selectedRegionId: string | null = null;
  #selectedFace: UVFace | null = null;
  #selectedState: UVRegionState | null = null;
  #showAll = false;

  readonly #onUvChanged = (): void => this.#sync();
  readonly #onVisibilityChanged = ({ showAll }: UvVisibilityChangedDetail): void => {
    this.#showAll = showAll;
    this.#host.requestUpdate();
  };

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.detach();
  }

  get selectedRegionId(): string | null {
    return this.#selectedRegionId;
  }

  get selectedFace(): UVFace | null {
    return this.#selectedFace;
  }

  attach(
    canvas: PixelArtCanvas
  ): void {
    this.detach();

    this.#canvas = canvas;
    canvas.uv.on("selection-changed", this.#onUvChanged);
    canvas.uv.on("region-state-changed", this.#onUvChanged);
    canvas.uv.on("region-created", this.#onUvChanged);
    canvas.uv.on("region-deleted", this.#onUvChanged);
    canvas.uv.on("visibility-changed", this.#onVisibilityChanged);
    this.#showAll = canvas.uv.showAll;
    this.#sync();
  }

  detach(): void {
    if (!this.#canvas) {
      return;
    }

    this.#canvas.uv.off("selection-changed", this.#onUvChanged);
    this.#canvas.uv.off("region-state-changed", this.#onUvChanged);
    this.#canvas.uv.off("region-created", this.#onUvChanged);
    this.#canvas.uv.off("region-deleted", this.#onUvChanged);
    this.#canvas.uv.off("visibility-changed", this.#onVisibilityChanged);
    this.#canvas = null;
  }

  create(): void {
    this.#canvas?.uv.create(kUvCreateSize);
  }

  delete(): void {
    if (this.#selectedRegionId) {
      this.#canvas?.uv.delete(this.#selectedRegionId);
    }
  }

  toggleShowAll(): void {
    if (this.#canvas) {
      this.#canvas.uv.showAll = !this.#canvas.uv.showAll;
    }
  }

  uncollapse(): void {
    if (this.#selectedRegionId) {
      this.#canvas?.uv.uncollapse(this.#selectedRegionId);
    }
  }

  collapse(): void {
    if (this.#selectedRegionId) {
      this.#canvas?.uv.collapse(
        this.#selectedRegionId,
        this.#selectedFace ?? undefined
      );
    }
  }

  #renderStateButton() {
    if (this.#selectedState === null) {
      return nothing;
    }

    return this.#selectedState === "collapsed" ?
      html`
        <button
          class="rail-btn" part="uv-uncollapse-button"
          aria-label="Uncollapse"
          @click=${() => this.uncollapse()}
        >
          ${renderIcon("expand")}
          <span class="tooltip">Uncollapse</span>
        </button>
      ` :
      html`
        <button
          class="rail-btn" part="uv-collapse-button"
          aria-label="Collapse"
          @click=${() => this.collapse()}
        >
          ${renderIcon("collapse")}
          <span class="tooltip">Collapse</span>
        </button>
      `;
  }

  #renderCreateDelete() {
    return html`
      <button
        class="rail-btn" part="uv-create-button"
        aria-label="Create"
        @click=${() => this.create()}
      >
        ${renderIcon("add")}
        <span class="tooltip">Create region</span>
      </button>
      <button
        class="rail-btn" part="uv-delete-button"
        aria-label="Delete"
        ?disabled=${!this.#selectedRegionId}
        @click=${() => this.delete()}
      >
        ${renderIcon("trash")}
        <span class="tooltip">Delete region</span>
      </button>
      <div class="overlay-toolbar-divider"></div>
    `;
  }

  render(
    active: boolean,
    allowCreateDelete: boolean
  ) {
    if (!active) {
      return nothing;
    }

    return html`
      <div class="overlay-toolbar top" part="uv-toolbar">
        ${allowCreateDelete ? this.#renderCreateDelete() : nothing}
        ${this.#renderStateButton()}
        <button
          class=${classMap({ "rail-btn": true, active: this.#showAll })}
          part="uv-show-all-button"
          aria-label="Show all"
          aria-pressed=${this.#showAll}
          @click=${() => this.toggleShowAll()}
        >
          ${renderIcon("eye")}
          <span class="tooltip">Show all regions</span>
        </button>
      </div>
    `;
  }

  #sync(): void {
    const uv = this.#canvas?.uv;
    this.#selectedRegionId = uv?.selectedRegionId ?? null;
    this.#selectedFace = uv?.selectedFace ?? null;
    this.#selectedState = this.#selectedRegionId ?
      uv?.get(this.#selectedRegionId)?.state ?? null :
      null;

    this.#host.requestUpdate();
  }
}
