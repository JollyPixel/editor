// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost
} from "lit";
import { PopoverController } from "@jolly-pixel/ui";
import type {
  PixelArtCanvas,
  UVRegionState
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../shared/icons.ts";
import {
  RAIL_DIVIDER,
  renderRailButton
} from "../shared/railButton.ts";

// CONSTANTS
const kUvCreateSize = {
  width: 16,
  height: 16
};
const kRampSlopeHeight = Math.round(kUvCreateSize.height * Math.SQRT2);

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

export type UvToolbarHost = ReactiveControllerHost & {
  renderRoot: DocumentFragment | HTMLElement;
};

type UVMap = PixelArtCanvas["uv"];

function renderBadgedIcon(
  badge: IconName
) {
  return html`
    <span class="icon-with-badge">
      ${renderIcon("add")}
      <span class="icon-badge">${renderIcon(badge)}</span>
    </span>
  `;
}

export class UvToolbarController {
  readonly #host: UvToolbarHost;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #statePopup: PopoverController;
  #uvNextId = 0;

  constructor(
    host: UvToolbarHost,
    canvas: () => PixelArtCanvas | null
  ) {
    this.#host = host;
    this.#canvas = canvas;
    this.#statePopup = new PopoverController(host, {
      anchor: () => this.#stateElement("[part=\"uv-state-button\"]"),
      popover: () => this.#stateElement("[part=\"uv-state-menu\"]"),
      side: "below",
      align: "start"
    });
  }

  #stateElement(
    selector: string
  ): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(selector);
  }

  #create(
    uv: UVMap
  ): void {
    uv.create({
      name: `cube-${++this.#uvNextId}`,
      ...kUvCreateSize
    });
  }

  #createRamp(
    uv: UVMap
  ): void {
    uv.create({
      name: `ramp-${++this.#uvNextId}`,
      ...kUvCreateSize,
      state: "stacked",
      activeSlots: ["back", "left", "right", "top", "bottom"],
      slotGeometries: {
        left: {
          shape: "triangle",
          corner: "bottom-right"
        },
        right: {
          shape: "triangle",
          corner: "bottom-right"
        },
        top: {
          shape: "rectangle",
          height: kRampSlopeHeight
        }
      }
    });
  }

  #setState(
    uv: UVMap,
    regionId: string,
    state: UVRegionState
  ): void {
    this.#statePopup.hide();
    uv.setState(
      regionId,
      state,
      state === "stacked" ? uv.selectedSlot ?? undefined : undefined
    );
  }

  #renderStateDropdown(
    uv: UVMap
  ) {
    const regionId = uv.selectedRegionId;
    const current = regionId ? uv.get(regionId)?.state : undefined;
    if (!regionId || current === undefined) {
      return nothing;
    }

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
        ${kStateOrder
          .filter((state) => state !== current)
          .map((state) => html`
            <button
              class="uv-state-option"
              part="uv-${state}-button"
              role="menuitem"
              @click=${() => this.#setState(uv, regionId, state)}
            >
              ${renderIcon(kStateIcons[state])}
              <span>${kStateLabels[state]}</span>
            </button>
          `)}
      </div>
    `;
  }

  #renderCreateDelete(
    uv: UVMap
  ) {
    const regionId = uv.selectedRegionId;

    return html`
      ${renderRailButton({
        part: "uv-create-button",
        label: "Create cube",
        tooltip: "Create cube region",
        icon: renderBadgedIcon("cube"),
        onClick: () => this.#create(uv)
      })}
      ${renderRailButton({
        part: "uv-create-ramp-button",
        label: "Create ramp",
        tooltip: "Create ramp region",
        icon: renderBadgedIcon("triangle"),
        onClick: () => this.#createRamp(uv)
      })}
      ${renderRailButton({
        part: "uv-delete-button",
        label: "Delete",
        tooltip: "Delete region",
        icon: "trash",
        disabled: !regionId,
        onClick: () => {
          if (regionId) {
            uv.delete(regionId);
          }
        }
      })}
      ${RAIL_DIVIDER}
    `;
  }

  renderVisibilityToggles() {
    const uv = this.#canvas()?.uv;

    return html`
      ${renderRailButton({
        part: "uv-show-region-labels-button",
        label: "Show region labels",
        icon: "label",
        pressed: uv?.showRegionLabels ?? false,
        onClick: () => {
          if (uv) {
            uv.showRegionLabels = !uv.showRegionLabels;
          }
        }
      })}
      ${renderRailButton({
        part: "uv-show-all-button",
        label: "Show all",
        tooltip: "Show all regions",
        icon: "eye",
        pressed: uv?.showAll ?? false,
        onClick: () => {
          if (uv) {
            uv.showAll = !uv.showAll;
          }
        }
      })}
    `;
  }

  render(
    active: boolean,
    allowCreateDelete: boolean
  ) {
    const uv = this.#canvas()?.uv;
    if (!active || !uv) {
      return nothing;
    }

    return html`
      <div class="overlay-toolbar top" part="uv-toolbar">
        ${allowCreateDelete ? this.#renderCreateDelete(uv) : nothing}
        ${this.#renderStateDropdown(uv)}
        ${this.renderVisibilityToggles()}
      </div>
    `;
  }
}
