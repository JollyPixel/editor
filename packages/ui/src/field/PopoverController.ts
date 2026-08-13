// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import { anchoredPosition } from "../geometry/anchoredPosition.ts";

// CONSTANTS
const kDefaultGap = 4;

export interface PopoverControllerOptions {
  /**
   * Anchor used for placement.
   */
  anchor: () => HTMLElement | null;
  /**
   * Popover element rendered by the host.
   */
  popover: () => HTMLElement | null;
  /**
   * Distance between the anchor edge and popover, in pixels.
   */
  gap?: number;
  /** Preferred side of the anchor. */
  side?: "above" | "below";
  /** Horizontal alignment against the anchor. */
  align?: "center" | "start";
  onOpen?: () => void;
  onClose?: () => void;
  /**
   * Called on Escape before the popover closes.
   */
  onCancel?: (event: KeyboardEvent) => void;
}

/**
 * Positions a native popover beside an anchor and restores focus on close.
 * The host renders the popover and trigger. The controller positions it as the
 * viewport changes and reports Escape cancellation.
 *
 * ```ts
 * #popup = new PopoverController(this, {
 *   anchor: () => this._button,
 *   popover: () => this._panel
 * });
 * ```
 */
export class PopoverController implements ReactiveController {
  #host: ReactiveControllerHost;
  #options: PopoverControllerOptions;
  #open = false;
  #restoreFocus = false;

  constructor(
    host: ReactiveControllerHost,
    options: PopoverControllerOptions
  ) {
    this.#host = host;
    this.#options = options;
    host.addController(this);
  }

  get open(): boolean {
    return this.#open;
  }

  /**
   * Handles the popover `beforetoggle` event.
   */
  onBeforeToggle = (
    event: ToggleEvent
  ): void => {
    if (event.newState !== "closed") {
      return;
    }

    const popover = this.#options.popover();
    this.#restoreFocus = popover !== null &&
      popover.matches(":focus-within");
  };

  /**
   * Handles the popover `toggle` event.
   */
  onToggle = (
    event: ToggleEvent
  ): void => {
    this.#open = event.newState === "open";

    if (this.#open) {
      this.reposition();
      this.#listen();
      this.#options.onOpen?.();
    }
    else {
      this.#unlisten();
      this.#options.onClose?.();

      if (this.#restoreFocus) {
        this.#options.anchor()?.focus();
      }
    }

    this.#host.requestUpdate();
  };

  hide(): void {
    this.#options.popover()?.hidePopover();
  }

  /**
   * Repositions the open popover.
   */
  reposition(): void {
    const anchor = this.#options.anchor();
    const popover = this.#options.popover();
    if (anchor === null || popover === null || !this.#open) {
      return;
    }

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = popover.getBoundingClientRect();

    const placed = anchoredPosition({
      anchor: {
        top: anchorRect.top,
        bottom: anchorRect.bottom,
        left: anchorRect.left,
        right: anchorRect.right
      },
      panel: {
        width: panelRect.width,
        height: panelRect.height
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      gap: this.#options.gap ?? kDefaultGap,
      side: this.#options.side,
      align: this.#options.align
    });

    popover.style.left = `${placed.x}px`;
    popover.style.top = `${placed.y}px`;
  }

  hostDisconnected(): void {
    this.#unlisten();
    this.#open = false;
  }

  readonly #onReposition = (): void => {
    this.reposition();
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    if (event.key === "Escape" && this.#open) {
      this.#options.onCancel?.(event);
    }
  };

  /**
   * Captures ancestor scrolling so the popover follows its anchor.
   */
  #listen(): void {
    window.addEventListener(
      "scroll",
      this.#onReposition,
      true
    );
    window.addEventListener(
      "resize",
      this.#onReposition
    );
    document.addEventListener(
      "keydown",
      this.#onKeyDown,
      true
    );
  }

  #unlisten(): void {
    window.removeEventListener(
      "scroll",
      this.#onReposition,
      true
    );
    window.removeEventListener(
      "resize",
      this.#onReposition
    );
    document.removeEventListener(
      "keydown",
      this.#onKeyDown,
      true
    );
  }
}
