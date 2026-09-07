// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import { classMap } from "lit/directives/class-map.js";
import { PopoverController } from "@jolly-pixel/ui";
import type {
  PixelArtCanvas,
  UVSlot,
  UVMapListener,
  UVRegionState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../common/icons.ts";

// UV "Create" button uses this preset size.
const kUvCreateSize = {
  width: 16,
  height: 16
};

const kStateLabels: Record<UVRegionState, string> = {
  stacked: "Stacked",
  unfolded: "Unfolded",
  free: "Free"
};

const kStateIcons: Record<UVRegionState, IconName> = {
  stacked: "collapse",
  unfolded: "unfold",
  free: "expand"
};

const kStateOrder: readonly UVRegionState[] = [
  "stacked",
  "unfolded",
  "free"
];

/**
 * Lit host rendering the toolbar; the controller reads back the state
 * dropdown's trigger and popover from its render root.
 */
export type UvToolbarHost = ReactiveControllerHost & {
  renderRoot: DocumentFragment | HTMLElement;
};

/**
 * UV toolbar state (selection, region state, visibility).
 * Syncs with PixelArtCanvas.uv; host renders toolbar only.
 */
export class UvToolbarController implements ReactiveController {
  #host: UvToolbarHost;
  #canvas: PixelArtCanvas | null = null;
  #statePopup: PopoverController;

  #selectedRegionId: string | null = null;
  #selectedFace: UVSlot | null = null;
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
    host: UvToolbarHost
  ) {
    this.#host = host;
    this.#statePopup = new PopoverController(host, {
      anchor: () => this.#stateElement("[part=\"uv-state-button\"]"),
      popover: () => this.#stateElement("[part=\"uv-state-menu\"]"),
      side: "below",
      align: "start"
    });
    host.addController(this);
  }

  hostDisconnected(): void {
    this.detach();
  }

  get selectedRegionId(): string | null {
    return this.#selectedRegionId;
  }

  get selectedFace(): UVSlot | null {
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
      state: "stacked",
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

  setState(
    state: UVRegionState
  ): void {
    this.#statePopup.hide();
    if (!this.#selectedRegionId) {
      return;
    }

    this.#canvas?.uv.setState(
      this.#selectedRegionId,
      state,
      state === "stacked" ? this.#selectedFace ?? undefined : undefined
    );
  }

  #stateElement(
    selector: string
  ): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(selector);
  }

  #renderStateMenu(
    current: UVRegionState
  ) {
    return kStateOrder
      .filter((state) => state !== current)
      .map((state) => html`
        <button
          class="uv-state-option"
          part="uv-${state}-button"
          role="menuitem"
          @click=${() => this.setState(state)}
        >
          ${renderIcon(kStateIcons[state])}
          <span>${kStateLabels[state]}</span>
        </button>
      `);
  }

  #renderStateDropdown() {
    if (this.#selectedState === null) {
      return nothing;
    }

    const current = this.#selectedState;

    return html`
      <button
        class="rail-btn uv-state-trigger"
        part="uv-state-button"
        popovertarget="uv-state-menu"
        aria-haspopup="menu"
        aria-expanded=${this.#statePopup.open}
        aria-label="Region state: ${kStateLabels[current]}"
      >
        ${renderIcon(kStateIcons[current])}
        ${renderIcon("chevronDown")}
        <span class="tooltip">Region state: ${kStateLabels[current]}</span>
      </button>
      <div
        class="uv-state-menu"
        part="uv-state-menu"
        id="uv-state-menu"
        role="menu"
        popover
        @beforetoggle=${this.#statePopup.onBeforeToggle}
        @toggle=${this.#statePopup.onToggle}
      >
        ${this.#renderStateMenu(current)}
      </div>
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
        ${this.#renderStateDropdown()}
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
