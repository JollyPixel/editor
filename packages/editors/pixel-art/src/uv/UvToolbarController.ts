// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import type {
  PixelArtCanvas,
  UVRegionState,
  UVTool
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
import {
  OverlayMenu,
  type OverlayMenuHost
} from "../shared/OverlayMenu.ts";
import type { UvNetController } from "./nets/UvNetController.ts";

// CONSTANTS
const kUvCreateSize = {
  width: 16,
  height: 16
};
const kRampSlopeHeight = Math.round(
  kUvCreateSize.height * Math.SQRT2
);

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

type UVMap = PixelArtCanvas["uv"];
type UVRegion = NonNullable<ReturnType<UVMap["get"]>>;

interface UVSelection {
  id: string;
  region: UVRegion;
}

function selectedRegion(
  uv: UVMap
): UVSelection | null {
  const id = uv.selectedRegionId;
  const region = id ? uv.get(id) : undefined;

  return id && region ? { id, region } : null;
}

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
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #stateMenu: OverlayMenu;
  readonly #nets: UvNetController;
  #uvNextId = 0;

  constructor(
    host: OverlayMenuHost,
    canvas: () => PixelArtCanvas | null,
    nets: UvNetController
  ) {
    this.#canvas = canvas;
    this.#nets = nets;
    this.#stateMenu = new OverlayMenu(host, "uv-state", {
      side: "below",
      hover: true
    });
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

  #applyState(
    uv: UVMap,
    regionId: string,
    state: UVRegionState
  ): void {
    this.#stateMenu.hide();
    uv.applyState(
      regionId,
      state,
      state === "stacked" ? uv.selectedSlot : null
    );
  }

  #renderStateDropdown(
    uv: UVMap,
    { id: regionId, region }: UVSelection
  ) {
    const current = region.state;

    return this.#stateMenu.render({
      label: `Region state: ${kStateLabels[current]}`,
      trigger: html`
        ${renderIcon(kStateIcons[current])}
        ${renderIcon("chevronDown")}
      `,
      items: html`
        ${kStateOrder
          .filter((state) => state !== current)
          .map((state) => html`
            <button
              class="overlay-menu-option"
              part="uv-${state}-button"
              role="menuitem"
              @click=${() => this.#applyState(uv, regionId, state)}
            >
              ${renderIcon(kStateIcons[state])}
              <span>${kStateLabels[state]}</span>
            </button>
          `)}
        ${this.#nets.renderMenu(regionId, region, () => this.#stateMenu.hide())}
      `
    });
  }

  #renderOrientationButtons(
    uv: UVMap,
    { id: regionId, region }: UVSelection
  ) {
    const slot = region.movementScope === "slot" ? uv.selectedSlot : null;
    const target = slot === null ? "region" : `slot "${slot}"`;
    const tool = this.#canvas()?.tools.uv;

    return html`
      ${renderRailButton({
        part: "uv-rotate-ccw-button",
        label: `Rotate ${target} counter-clockwise`,
        tooltip: `Rotate ${target} 90° counter-clockwise`,
        icon: "rotateCounterClockwise",
        text: "90°",
        onClick: () => uv.rotate(regionId, "ccw", slot)
      })}
      ${renderRailButton({
        part: "uv-rotate-cw-button",
        label: `Rotate ${target} clockwise`,
        tooltip: `Rotate ${target} 90° clockwise`,
        icon: "rotateClockwise",
        text: "90°",
        onClick: () => uv.rotate(regionId, "cw", slot)
      })}
      ${tool?.mirrorable ?
        this.#renderMirrorButtons(tool, target, !region.canMirror(slot)) :
        nothing}
    `;
  }

  #renderMirrorButtons(
    tool: UVTool,
    target: string,
    disabled: boolean
  ) {
    return html`
      ${renderRailButton({
        part: "uv-mirror-horizontal-button",
        label: `Mirror ${target} horizontally`,
        icon: "flipHorizontal",
        disabled,
        onClick: () => tool.mirror("horizontal")
      })}
      ${renderRailButton({
        part: "uv-mirror-vertical-button",
        label: `Mirror ${target} vertically`,
        icon: "flipVertical",
        disabled,
        onClick: () => tool.mirror("vertical")
      })}
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

  render(
    active: boolean,
    allowCreateDelete: boolean,
    extra: TemplateResult | typeof nothing = nothing
  ) {
    const uv = this.#canvas()?.uv;
    if (!active || !uv) {
      return nothing;
    }

    const selection = selectedRegion(uv);
    if (!allowCreateDelete && selection === null && extra === nothing) {
      return nothing;
    }

    return html`
      <div class="overlay-toolbar" part="uv-toolbar">
        ${allowCreateDelete ? this.#renderCreateDelete(uv) : nothing}
        ${selection === null ? nothing : html`
          ${this.#renderStateDropdown(uv, selection)}
          ${this.#renderOrientationButtons(uv, selection)}
        `}
        ${extra}
      </div>
    `;
  }
}
