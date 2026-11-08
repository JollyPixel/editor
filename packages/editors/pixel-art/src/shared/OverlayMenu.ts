// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveControllerHost,
  type TemplateResult
} from "lit";
import {
  PopoverController,
  type AnchorRect
} from "@jolly-pixel/ui";

// CONSTANTS
const kHoverDelay = {
  delay: 200
};

function toolbarSlot(
  trigger: HTMLElement | null
): AnchorRect | null {
  const toolbar = trigger?.closest<HTMLElement>(".overlay-toolbar");
  if (!trigger || !toolbar) {
    return null;
  }

  const bar = toolbar.getBoundingClientRect();
  const button = trigger.getBoundingClientRect();
  const style = getComputedStyle(toolbar);

  return {
    top: bar.top,
    bottom: bar.bottom,
    left: Math.max(bar.left, button.left - parseFloat(style.paddingLeft)),
    right: Math.min(bar.right, button.right + parseFloat(style.paddingRight))
  };
}

export type OverlayMenuHost = ReactiveControllerHost & {
  renderRoot: DocumentFragment | HTMLElement;
};

export interface OverlayMenuOptions {
  side: "above" | "below";
  hover: boolean;
}

export interface OverlayMenuContent {
  label: string;
  trigger: unknown;
  items: unknown;
  role?: "menu" | "dialog";
  menuLabel?: string;
  description?: string;
  disabled?: boolean;
}

export class OverlayMenu {
  readonly #name: string;
  readonly #popup: PopoverController;

  constructor(
    host: OverlayMenuHost,
    name: string,
    options: OverlayMenuOptions
  ) {
    this.#name = name;
    function part(
      suffix: string
    ): HTMLElement | null {
      return host.renderRoot
        .querySelector<HTMLElement>(`[part="${name}-${suffix}"]`);
    }
    this.#popup = new PopoverController(host, {
      anchor: () => part("button"),
      popover: () => part("menu"),
      placeAgainst: () => toolbarSlot(part("button")),
      side: options.side,
      align: "start",
      ...(options.hover ?
        {
          openOnHover: kHoverDelay,
          closeOnHoverLeave: kHoverDelay
        } :
        {})
    });
  }

  hide(): void {
    this.#popup.hide();
  }

  render(
    content: OverlayMenuContent
  ): TemplateResult {
    const name = this.#name;
    const popup = this.#popup;
    const role = content.role ?? "menu";

    return html`
      <button
        type="button"
        class="rail-btn overlay-menu-trigger ${name}-trigger"
        part="${name}-button"
        popovertarget="${name}-menu"
        aria-haspopup=${role}
        aria-expanded=${popup.open}
        aria-label=${content.label}
        aria-description=${content.description ?? nothing}
        ?disabled=${content.disabled === true}
        @pointerenter=${popup.onPointerEnter}
        @pointerleave=${popup.onPointerLeave}
      >${content.trigger}</button>
      <div
        class="overlay-menu ${name}-menu"
        part="${name}-menu"
        id="${name}-menu"
        role=${role}
        aria-label=${content.menuLabel ?? nothing}
        popover
        @pointerenter=${popup.onPointerEnter}
        @pointerleave=${popup.onPointerLeave}
        @beforetoggle=${popup.onBeforeToggle}
        @toggle=${popup.onToggle}
      >${content.items}</div>
    `;
  }
}
