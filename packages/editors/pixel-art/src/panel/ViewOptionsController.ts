// Import Third-party Dependencies
import {
  html,
  nothing
} from "lit";
import type {
  JollyChangeDetail,
  JollyOption
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button-group";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../shared/icons.ts";
import {
  OverlayMenu,
  type OverlayMenuHost
} from "../shared/OverlayMenu.ts";

// CONSTANTS
const kGridSizes: readonly number[] = [8, 16, 32, 64];

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
  readonly #host: OverlayMenuHost;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #menu: OverlayMenu;

  constructor(
    host: OverlayMenuHost,
    canvas: () => PixelArtCanvas | null
  ) {
    this.#host = host;
    this.#canvas = canvas;
    this.#menu = new OverlayMenu(host, "view-options", {
      side: "below",
      hover: true
    });
  }

  #renderToggle<TKey extends PropertyKey>(
    target: Record<TKey, boolean>,
    key: TKey,
    toggle: ViewToggle
  ) {
    return html`
      <label class="overlay-menu-option">
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
        ${this.#menu.render({
          role: "dialog",
          label: "View options",
          menuLabel: "View options",
          description: canvas ? this.#describe(canvas, menu) : undefined,
          disabled: !canvas,
          trigger: html`
            ${renderIcon(this.#icon(canvas, menu))}
            ${renderIcon("chevronDown")}
          `,
          items: html`
            ${canvas && menu.regions ? this.#renderRegions(canvas.uv) : nothing}
            ${canvas ? this.#renderGrid(canvas.grid, menu) : nothing}
          `
        })}
      </div>
    `;
  }
}
