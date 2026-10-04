// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import {
  anchoredPosition,
  type AnchorRect
} from "../geometry/anchoredPosition.ts";
import { inputLayers } from "../interaction/input/InputLayers.ts";
import { placePopover } from "./placePopover.ts";

// CONSTANTS
const kDefaultGap = 4;

export interface PopoverControllerOptions {
  /**
   * Anchor used for placement.
   */
  anchor: () => HTMLElement | AnchorRect | null;
  /**
   * Popover element rendered by the host.
   */
  popover: () => HTMLElement | null;
  /**
   * Distance between the anchor edge and popover, in pixels.
   */
  gap?: number;
  /**
   * Preferred side of the anchor.
   */
  side?: "above" | "below" | "left" | "right";
  /**
   * Alignment on the axis perpendicular to `side`: horizontal for
   * "above"/"below", vertical for "left"/"right".
   */
  align?: "center" | "start";
  onOpen?: () => void;
  onClose?: () => void;
  /**
   * Called after each placement of the open popover, including those on
   * scroll and resize.
   */
  onReposition?: () => void;
  /**
   * Called on Escape before the popover closes.
   */
  onCancel?: (event: KeyboardEvent) => void;
}

/**
 * Positions a native popover beside an anchor and restores focus on close.
 */
export class PopoverController implements ReactiveController {
  #host: ReactiveControllerHost;
  #options: PopoverControllerOptions;
  #open = false;
  #restoreFocus = false;
  #releaseInputLayer: (() => void) | null = null;

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

  onBeforeToggle = (
    event: ToggleEvent
  ): void => {
    if (event.newState === "open") {
      this.#claimInput();
      setTimeout(() => {
        if (!this.#options.popover()?.matches(":popover-open")) {
          this.#releaseInput();
        }
      });

      return;
    }

    const popover = this.#options.popover();
    this.#restoreFocus = popover !== null &&
      popover.matches(":focus-within");
    this.#releaseInput();
  };

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

      const anchor = this.#options.anchor();
      if (this.#restoreFocus && anchor instanceof HTMLElement) {
        anchor.focus();
      }
    }

    this.#host.requestUpdate();
  };

  show(): void {
    this.#options.popover()?.showPopover();
    this.reposition();
  }

  hide(): void {
    this.#options.popover()?.hidePopover();
  }

  reposition(): void {
    const anchor = this.#options.anchor();
    const popover = this.#options.popover();
    if (
      anchor === null ||
      popover === null ||
      !popover.matches(":popover-open")
    ) {
      return;
    }

    const anchorRect = anchor instanceof HTMLElement ?
      anchor.getBoundingClientRect() :
      anchor;
    const anchorBox = {
      top: anchorRect.top,
      bottom: anchorRect.bottom,
      left: anchorRect.left,
      right: anchorRect.right
    };

    placePopover(popover, anchorBox, (panel, viewport) => anchoredPosition({
      anchor: anchorBox,
      panel,
      viewport,
      gap: this.#options.gap ?? kDefaultGap,
      side: this.#options.side,
      align: this.#options.align
    }));
    this.#options.onReposition?.();
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

  #claimInput(): void {
    this.#releaseInputLayer ??= inputLayers.push({
      dismiss: () => {
        this.hide();

        return true;
      }
    });
  }

  #releaseInput(): void {
    this.#releaseInputLayer?.();
    this.#releaseInputLayer = null;
  }

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
    this.#releaseInput();
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
