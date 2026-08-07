// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import type {
  PixelArtCanvas,
  UVFace,
  UVRegionState
} from "@jolly-pixel/pixel-draw.renderer";

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
      html`<button @click=${() => this.uncollapse()}>Uncollapse</button>` :
      html`<button @click=${() => this.collapse()}>Collapse</button>`;
  }

  render(
    active: boolean
  ) {
    if (!active) {
      return nothing;
    }

    return html`
      <div class="uv-toolbar" part="uv-toolbar">
        <button @click=${() => this.create()}>Create</button>
        <button ?disabled=${!this.#selectedRegionId} @click=${() => this.delete()}>Delete</button>
        ${this.#renderStateButton()}
        ${this.#selectedFace ?
          html`<span class="uv-face" part="uv-face">${this.#selectedFace}</span>` :
          nothing}
        <label>
          <input
            type="checkbox"
            .checked=${this.#showAll}
            @change=${() => this.toggleShowAll()}>
          Show all
        </label>
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
