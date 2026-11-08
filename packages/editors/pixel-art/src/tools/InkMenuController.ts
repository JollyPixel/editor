// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import "@jolly-pixel/ui/elements/icon";
import type {
  BrushInkName,
  PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

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
const kInks: Readonly<Record<BrushInkName, Ink>> = {
  blend: {
    icon: "inkBlend",
    label: "Blend",
    description: "Translucent colors mix with the pixels under them"
  },
  replace: {
    icon: "inkReplace",
    label: "Replace",
    description: "Overwrites pixels, alpha included"
  },
  "lock-alpha": {
    icon: "inkLockAlpha",
    label: "Lock alpha",
    description: "Recolors visible pixels, keeps their transparency"
  }
};
const kInkOrder: readonly BrushInkName[] = [
  "blend",
  "replace",
  "lock-alpha"
];

interface Ink {
  icon: IconName;
  label: string;
  description: string;
}

export class InkMenuController {
  readonly #host: OverlayMenuHost;
  readonly #menu: OverlayMenu;

  constructor(
    host: OverlayMenuHost
  ) {
    this.#host = host;
    this.#menu = new OverlayMenu(host, "ink", {
      side: "below",
      hover: true
    });
  }

  #select(
    canvas: PixelArtCanvas,
    name: BrushInkName
  ): void {
    canvas.brush.ink = name;
    this.#menu.hide();
    this.#host.requestUpdate();
  }

  render(
    canvas: PixelArtCanvas
  ): TemplateResult {
    const current = kInks[canvas.brush.ink];

    return html`
      <div class="overlay-toolbar" part="ink-overlay">
        ${this.#menu.render({
          label: `Brush ink: ${current.label}`,
          menuLabel: "Brush ink",
          trigger: html`
            <span class="tool-option-label">Ink</span>
            ${renderIcon(current.icon)}
            <span class="ink-current">${current.label}</span>
            ${renderIcon("chevronDown")}
          `,
          items: kInkOrder.map((name) => html`
            <button
              type="button"
              class="overlay-menu-option ink-option"
              part="ink-option"
              role="menuitemradio"
              aria-checked=${name === canvas.brush.ink ? "true" : "false"}
              @click=${() => this.#select(canvas, name)}
            >
              ${renderIcon(kInks[name].icon)}
              <span class="ink-option-text">
                <span class="ink-option-label">${kInks[name].label}</span>
                <span class="ink-option-description">${kInks[name].description}</span>
              </span>
              <jolly-icon
                class="icon ink-check"
                name="check"
                aria-hidden="true"
              ></jolly-icon>
            </button>
          `)
        })}
      </div>
    `;
  }
}
