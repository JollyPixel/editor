// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";
import "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  renderIcon,
  type IconName
} from "../shared/icons.ts";
import { iconStyles } from "../shared/icon.styles.ts";
import { railButtonStyles } from "../shared/railButton.styles.ts";
import {
  UvAccessPolicy,
  type UvAccess
} from "../uv/UvAccessPolicy.ts";
import {
  DEFAULT_TOOL_OPTIONS,
  type ToolOption,
  type ToolOptionName,
  type ToolOptions
} from "./toolOptions.ts";

interface ModeVariant {
  option: ToolOptionName;
  icon: IconName;
  label: string;
  offLabel: string;
}

interface ModeToggle {
  option: ToolOptionName;
  icon: IconName;
  label: string;
  badge: string;
}

interface ModeItem {
  mode: Mode;
  icon: IconName;
  label: string;
  variant?: ModeVariant;
  uvToggle?: ModeToggle;
}

interface FlyoutButton {
  icon: IconName;
  label: string;
  pressed?: boolean;
  option: ToolOption;
}

// CONSTANTS
const kModeItems: ModeItem[] = [
  {
    mode: "move",
    icon: "move",
    label: "Move"
  },
  {
    mode: "paint",
    icon: "paint",
    label: "Paint",
    variant: {
      option: "pickColor",
      icon: "eyedropper",
      label: "Pick color",
      offLabel: "Paint"
    }
  },
  {
    mode: "erase",
    icon: "eraser",
    label: "Erase"
  },
  {
    mode: "fill",
    icon: "fill",
    label: "Fill",
    variant: {
      option: "fillGlobal",
      icon: "fillGlobal",
      label: "Global",
      offLabel: "Neighbor"
    },
    uvToggle: {
      option: "fillUvClip",
      icon: "uv",
      label: "Clip to UV",
      badge: "UV"
    }
  },
  {
    mode: "select",
    icon: "select",
    label: "Select",
    variant: {
      option: "selectShape",
      icon: "wand",
      label: "Shape",
      offLabel: "Rectangle"
    }
  },
  {
    mode: "uv",
    icon: "uv",
    label: "UV"
  }
];

function blurTarget(
  event: Event
): void {
  if (event.currentTarget instanceof HTMLElement) {
    event.currentTarget.blur();
  }
}

@customElement("mode-rail")
export class ModeRail extends LitElement {
  static override styles = [
    iconStyles,
    railButtonStyles,
    css`
      jolly-rail {
        background: transparent;
      }

      .rail-item.open .rail-flyout,
      .rail-item:focus-within .rail-flyout {
        max-width: 84px;
      }

      .rail-badge {
        position: absolute;
        top: 1px;
        right: 2px;
        color: currentcolor;
        font-size: 8px;
        font-weight: 700;
        line-height: 11px;
        pointer-events: none;
      }
    `
  ];

  @property({ type: String })
  declare mode: Mode;

  @property({ attribute: false })
  declare options: ToolOptions;

  @property({ type: String })
  declare uvAccess: UvAccess;

  #hoveredMode: Mode | null = null;

  constructor() {
    super();
    this.mode = "paint";
    this.options = DEFAULT_TOOL_OPTIONS;
    this.uvAccess = "edit";
  }

  #emit<T>(
    type: string,
    detail: T
  ): void {
    this.dispatchEvent(new CustomEvent<T>(type, {
      bubbles: true,
      composed: true,
      detail
    }));
    this.#hover(null);
  }

  #hover(
    mode: Mode | null
  ): void {
    this.#hoveredMode = mode;
    this.requestUpdate();
  }

  #flyoutButtons(
    item: ModeItem,
    fillClip: boolean
  ): FlyoutButton[] {
    const buttons: FlyoutButton[] = [];
    const { variant, uvToggle } = item;
    if (variant) {
      const on = this.options[variant.option];
      buttons.push({
        icon: on ? item.icon : variant.icon,
        label: on ? variant.offLabel : variant.label,
        option: {
          name: variant.option,
          value: !on
        }
      });
    }
    if (uvToggle && fillClip) {
      const on = this.options[uvToggle.option];
      buttons.push({
        icon: uvToggle.icon,
        label: uvToggle.label,
        pressed: on,
        option: {
          name: uvToggle.option,
          value: !on
        }
      });
    }

    return buttons;
  }

  #renderFlyout(
    buttons: FlyoutButton[]
  ) {
    if (buttons.length === 0) {
      return nothing;
    }

    return html`
      <div class="rail-flyout" part="rail-flyout">
        ${buttons.map(({ icon, label, pressed, option }) => html`
          <button
            class=${classMap({ "rail-btn": true, active: pressed === true })}
            part="rail-flyout-button"
            title=${label}
            aria-label=${label}
            aria-pressed=${pressed ?? nothing}
            @click=${(event: MouseEvent) => {
              this.#emit<ToolOption>("tool-option-change", option);
              blurTarget(event);
            }}
          >
            ${renderIcon(icon)}
          </button>
        `)}
      </div>
    `;
  }

  #renderItem(
    item: ModeItem,
    fillClip: boolean
  ) {
    const { mode, icon, label, variant, uvToggle } = item;
    const flyoutButtons = this.#flyoutButtons(item, fillClip);
    const displayIcon = variant && this.options[variant.option] ? variant.icon : icon;
    const showBadge = uvToggle && fillClip && this.options[uvToggle.option];

    return html`
      <div
        class=${classMap({ "rail-item": true, open: this.#hoveredMode === mode })}
        @mouseenter=${() => this.#hover(mode)}
        @mouseleave=${() => this.#hover(null)}
      >
        <button
          class=${classMap({
            "rail-btn": true,
            "has-flyout": flyoutButtons.length > 0,
            active: this.mode === mode
          })}
          part="mode-button"
          aria-label=${label}
          aria-pressed=${this.mode === mode}
          @click=${(event: MouseEvent) => {
            this.#emit<Mode>("mode-change", mode);
            blurTarget(event);
          }}
        >
          ${renderIcon(displayIcon)}
          ${showBadge ?
            html`<span class="rail-badge" part="uv-clip-badge">${uvToggle.badge}</span>` :
            nothing}
          ${flyoutButtons.length === 0 ? html`<span class="tooltip">${label}</span>` : nothing}
        </button>
        ${this.#renderFlyout(flyoutButtons)}
      </div>
    `;
  }

  override render() {
    const policy = UvAccessPolicy.of(this.uvAccess);
    const items = kModeItems.filter((item) => item.mode !== "uv" || policy.uvMode);

    return html`
      <jolly-rail role="group" aria-label="Drawing mode">
        ${items.map((item) => this.#renderItem(item, policy.fillClip))}
      </jolly-rail>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "mode-rail": ModeRail;
  }

  interface HTMLElementEventMap {
    "mode-change": CustomEvent<Mode>;
    "tool-option-change": CustomEvent<ToolOption>;
  }
}
