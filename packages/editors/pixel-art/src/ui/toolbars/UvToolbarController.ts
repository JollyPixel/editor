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
  UVMapListener,
  UVRegionState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { renderIcon } from "../common/icons.ts";

// UV "Create" button uses this preset size.
const kUvCreateSize = {
  width: 16,
  height: 16
};

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
  #showRegionLabels = false;
  #uvNextId = 0;

  readonly #onUvChanged = (): void => this.#sync();
  readonly #onVisibilityChanged: UVMapListener<"visibility-changed"> = ({ showAll }) => {
    this.#showAll = showAll;
    this.#host.requestUpdate();
  };
  readonly #onLabelVisibilityChanged: UVMapListener<"label-visibility-changed"> = ({
    showRegionLabels
  }) => {
    this.#showRegionLabels = showRegionLabels;
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
    canvas.uv.on("label-visibility-changed", this.#onLabelVisibilityChanged);
    this.#showAll = canvas.uv.showAll;
    this.#showRegionLabels = canvas.uv.showRegionLabels;
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
    this.#canvas.uv.off("label-visibility-changed", this.#onLabelVisibilityChanged);
    this.#canvas = null;
  }

  create(): void {
    this.#canvas?.uv.create({
      name: `cube-${++this.#uvNextId}`,
      ...kUvCreateSize
    });
  }

  createRamp(): void {
    this.#canvas?.uv.create({
      name: `ramp-${++this.#uvNextId}`,
      ...kUvCreateSize,
      state: "collapsed",
      activeFaces: ["back", "left", "right", "top", "bottom"],
      faceGeometries: {
        left: {
          shape: "triangle",
          corner: "bottom-right"
        },
        right: {
          shape: "triangle",
          corner: "bottom-right"
        }
      }
    });
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

  toggleShowRegionLabels(): void {
    if (this.#canvas && !this.#canvas.uv.showAll) {
      this.#canvas.uv.showRegionLabels = !this.#canvas.uv.showRegionLabels;
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
        aria-label="Create cube"
        @click=${() => this.create()}
      >
        <span class="icon-with-badge">
          ${renderIcon("add")}
          <span class="icon-badge">${renderIcon("cube")}</span>
        </span>
        <span class="tooltip">Create cube region</span>
      </button>
      <button
        class="rail-btn" part="uv-create-ramp-button"
        aria-label="Create ramp"
        @click=${() => this.createRamp()}
      >
        <span class="icon-with-badge">
          ${renderIcon("add")}
          <span class="icon-badge">${renderIcon("triangle")}</span>
        </span>
        <span class="tooltip">Create ramp region</span>
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

    const showRegionLabels = this.#showAll || this.#showRegionLabels;

    return html`
      <div class="overlay-toolbar top" part="uv-toolbar">
        ${allowCreateDelete ? this.#renderCreateDelete() : nothing}
        ${this.#renderStateButton()}
        <button
          class=${classMap({ "rail-btn": true, active: showRegionLabels })}
          part="uv-show-region-labels-button"
          aria-label="Show region labels"
          aria-pressed=${showRegionLabels}
          ?disabled=${this.#showAll}
          @click=${() => this.toggleShowRegionLabels()}
        >
          ${renderIcon("label")}
          <span class="tooltip">Show region labels</span>
        </button>
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
