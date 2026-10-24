// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost
} from "lit";
import {
  PopoverController,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button-group";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../shared/icons.ts";

// CONSTANTS
const kGridSizes: readonly number[] = [8, 16, 32, 64];

export type ViewOptionsHost = ReactiveControllerHost & {
  renderRoot: DocumentFragment | HTMLElement;
};

export interface ViewOptionsMenu {
  regions: boolean;
  gridSnap: boolean;
  gridSizeLocked: boolean;
}

interface ViewToggle {
  part: string;
  icon: IconName;
  label: string;
}

function gridSizeOptions(
  current: number
): JollyOption<number>[] {
  const sizes = kGridSizes.includes(current) ?
    kGridSizes :
    [...kGridSizes, current].sort((left, right) => left - right);

  return sizes.map((size) => {
    return {
      label: String(size),
      value: size
    };
  });
}

export class ViewOptionsController {
  readonly #host: ViewOptionsHost;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #popup: PopoverController;

  constructor(
    host: ViewOptionsHost,
    canvas: () => PixelArtCanvas | null
  ) {
    this.#host = host;
    this.#canvas = canvas;
    this.#popup = new PopoverController(host, {
      anchor: () => this.#element("[part=\"view-options-button\"]"),
      popover: () => this.#element("[part=\"view-options-menu\"]"),
      side: "below",
      align: "start",
      openOnHover: {
        delay: 200
      },
      closeOnHoverLeave: {
        delay: 200
      }
    });
  }

  #element(
    selector: string
  ): HTMLElement | null {
    return this.#host.renderRoot.querySelector<HTMLElement>(selector);
  }

  #renderToggle<TKey extends PropertyKey>(
    target: Record<TKey, boolean>,
    key: TKey,
    toggle: ViewToggle
  ) {
    return html`
      <label class="uv-state-option">
        <input
          type="checkbox"
          part=${toggle.part}
          .checked=${target[key]}
          @change=${() => {
            target[key] = !target[key];
            this.#host.requestUpdate();
          }}
        >
        ${renderIcon(toggle.icon)}
        <span>${toggle.label}</span>
      </label>
    `;
  }

  #renderRegions(
    uv: PixelArtCanvas["uv"]
  ) {
    return html`
      ${this.#renderToggle(uv, "showAll", {
        part: "uv-show-all-checkbox",
        icon: uv.showAll ? "eyeOpen" : "eyeOff",
        label: "Show all regions"
      })}
      ${this.#renderToggle(uv, "showRegionLabels", {
        part: "uv-show-region-labels-checkbox",
        icon: "label",
        label: "Show region labels"
      })}
      ${this.#renderToggle(uv, "showSizeLabels", {
        part: "uv-show-size-labels-checkbox",
        icon: "ruler",
        label: "Show UV size"
      })}
      <div class="view-options-divider" role="separator"></div>
    `;
  }

  #renderGrid(
    grid: PixelArtCanvas["grid"],
    menu: ViewOptionsMenu
  ) {
    return html`
      ${this.#renderToggle(grid, "visible", {
        part: "grid-visible-checkbox",
        icon: "grid",
        label: "Show grid"
      })}
      ${menu.gridSnap ? this.#renderToggle(grid, "snap", {
        part: "grid-snap-checkbox",
        icon: "magnet",
        label: "Snap UVs to grid"
      }) : nothing}
      ${menu.gridSizeLocked ? nothing : html`
        <jolly-button-group
          class="grid-size"
          part="grid-size"
          label="Grid cell size"
          label-position="top"
          .options=${gridSizeOptions(grid.size)}
          .value=${grid.size}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
            grid.size = event.detail.value;
            this.#host.requestUpdate();
          }}
        ></jolly-button-group>
      `}
    `;
  }

  #icon(
    canvas: PixelArtCanvas | null,
    menu: ViewOptionsMenu
  ): IconName {
    if (!menu.regions) {
      return "grid";
    }

    return canvas?.uv.showAll ? "eyeOpen" : "eyeOff";
  }

  #describe(
    canvas: PixelArtCanvas,
    menu: ViewOptionsMenu
  ): string {
    const { uv, grid } = canvas;
    const gridState = grid.visible ? `grid ${grid.size} pixels` : "grid off";
    if (!menu.regions) {
      return gridState;
    }

    return [
      uv.showAll ? "All regions" : "Selected region",
      `labels ${uv.showRegionLabels ? "on" : "off"}`,
      `size ${uv.showSizeLabels ? "on" : "off"}`,
      gridState
    ].join("; ");
  }

  render(
    menu: ViewOptionsMenu
  ) {
    const canvas = this.#canvas();

    return html`
      <div class="overlay-toolbar" part="view-options-toolbar">
        <button
          class="rail-btn uv-state-trigger"
          part="view-options-button"
          popovertarget="view-options-menu"
          aria-haspopup="dialog"
          aria-expanded=${this.#popup.open}
          aria-label="View options"
          aria-description=${canvas ? this.#describe(canvas, menu) : nothing}
          ?disabled=${!canvas}
          @pointerenter=${this.#popup.onPointerEnter}
          @pointerleave=${this.#popup.onPointerLeave}
        >
          ${renderIcon(this.#icon(canvas, menu))}
          ${renderIcon("chevronDown")}
        </button>
        <div
          class="uv-state-menu view-options-menu"
          part="view-options-menu"
          id="view-options-menu"
          role="dialog"
          aria-label="View options"
          popover
          @pointerenter=${this.#popup.onPointerEnter}
          @pointerleave=${this.#popup.onPointerLeave}
          @beforetoggle=${this.#popup.onBeforeToggle}
          @toggle=${this.#popup.onToggle}
        >
          ${canvas && menu.regions ? this.#renderRegions(canvas.uv) : nothing}
          ${canvas ? this.#renderGrid(canvas.grid, menu) : nothing}
        </div>
      </div>
    `;
  }
}
