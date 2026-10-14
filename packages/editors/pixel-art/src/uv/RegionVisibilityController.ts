// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost
} from "lit";
import { PopoverController } from "@jolly-pixel/ui";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../shared/icons.ts";

export type RegionVisibilityHost = ReactiveControllerHost & {
  renderRoot: DocumentFragment | HTMLElement;
};

type UVMap = PixelArtCanvas["uv"];

interface UVViewToggle {
  key: "showAll" | "showRegionLabels" | "showSizeLabels";
  part: string;
  icon: IconName;
  label: string;
}

export class RegionVisibilityController {
  readonly #host: RegionVisibilityHost;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #popup: PopoverController;

  constructor(
    host: RegionVisibilityHost,
    canvas: () => PixelArtCanvas | null
  ) {
    this.#host = host;
    this.#canvas = canvas;
    this.#popup = new PopoverController(host, {
      anchor: () => this.#element("[part=\"uv-visibility-button\"]"),
      popover: () => this.#element("[part=\"uv-visibility-menu\"]"),
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

  #renderToggle(
    uv: UVMap | undefined,
    toggle: UVViewToggle
  ) {
    return html`
      <label class="uv-state-option">
        <input
          type="checkbox"
          part=${toggle.part}
          .checked=${uv?.[toggle.key] ?? false}
          @change=${() => {
            if (uv) {
              uv[toggle.key] = !uv[toggle.key];
              this.#host.requestUpdate();
            }
          }}
        >
        ${renderIcon(toggle.icon)}
        <span>${toggle.label}</span>
      </label>
    `;
  }

  render(
    enabled: boolean
  ) {
    if (!enabled) {
      return nothing;
    }

    const uv = this.#canvas()?.uv;
    const showAllIcon = uv?.showAll ? "eyeOpen" : "eyeOff";

    return html`
      <div class="overlay-toolbar" part="uv-visibility-toolbar">
        <button
          class="rail-btn uv-state-trigger"
          part="uv-visibility-button"
          popovertarget="uv-visibility-menu"
          aria-haspopup="dialog"
          aria-expanded=${this.#popup.open}
          aria-label="Region visibility"
          aria-description="${uv?.showAll ? "All regions" : "Selected region"};
            labels ${uv?.showRegionLabels ? "on" : "off"};
            size ${uv?.showSizeLabels ? "on" : "off"}"
          ?disabled=${!uv}
          @pointerenter=${this.#popup.onPointerEnter}
          @pointerleave=${this.#popup.onPointerLeave}
        >
          ${renderIcon(showAllIcon)}
          ${renderIcon("chevronDown")}
        </button>
        <div
          class="uv-state-menu uv-visibility-menu"
          part="uv-visibility-menu"
          id="uv-visibility-menu"
          role="dialog"
          aria-label="Region visibility"
          popover
          @pointerenter=${this.#popup.onPointerEnter}
          @pointerleave=${this.#popup.onPointerLeave}
          @beforetoggle=${this.#popup.onBeforeToggle}
          @toggle=${this.#popup.onToggle}
        >
          ${this.#renderToggle(uv, {
            key: "showAll",
            part: "uv-show-all-checkbox",
            icon: showAllIcon,
            label: "Show all regions"
          })}
          ${this.#renderToggle(uv, {
            key: "showRegionLabels",
            part: "uv-show-region-labels-checkbox",
            icon: "label",
            label: "Show region labels"
          })}
          ${this.#renderToggle(uv, {
            key: "showSizeLabels",
            part: "uv-show-size-labels-checkbox",
            icon: "ruler",
            label: "Show UV size"
          })}
        </div>
      </div>
    `;
  }
}
