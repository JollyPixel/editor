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
const kDefaultHoverDelay = 200;
const kDefaultHoverCloseDelay = 200;

export type PopoverSide = "above" | "below" | "left" | "right";

export interface PopoverControllerOptions {
  /**
   * Element or viewport rectangle used for placement.
   */
  anchor: () => HTMLElement | AnchorRect | null;
  /**
   * Native popover element rendered by the host.
   */
  popover: () => HTMLElement | null;
  /**
   * Gap from the anchor in pixels; defaults to 4.
   */
  gap?: number;
  /**
   * Preferred side; callbacks run on each placement.
   */
  side?: PopoverSide | (() => PopoverSide);
  /**
   * Alignment perpendicular to the side; defaults to start.
   */
  align?: "center" | "start";
  /**
   * Enable hover opening; bind both pointer handlers to the trigger.
   */
  openOnHover?: {
    /**
     * Delay in milliseconds; defaults to 200. Zero opens immediately.
     */
    delay?: number;
  };
  /**
   * Enable hover closing; bind both pointer handlers to trigger and popover.
   */
  closeOnHoverLeave?: {
    /**
     * Delay in milliseconds; defaults to 200. Zero closes immediately.
     */
    delay?: number;
  };
  /**
   * Pushes an input layer while open, so keys stop reaching shortcuts;
   * defaults to true. Turn it off for a hint that only describes.
   */
  claimsInput?: boolean;
  /**
   * Called when the popover opens.
   */
  onOpen?: () => void;
  /**
   * Called when the popover closes or its element anchor is replaced.
   */
  onClose?: () => void;
  /**
   * Called after placement, including on scroll and resize.
   */
  onReposition?: () => void;
  /**
   * Called on Escape before closing.
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
  #activePopover: HTMLElement | null = null;
  #activeAnchor: HTMLElement | null = null;
  #hoverTimer: ReturnType<typeof setTimeout> | null = null;
  #hoverCloseTimer: ReturnType<typeof setTimeout> | null = null;
  #restoreFocus = false;
  #pointerInteraction = false;
  #pinned = false;
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

  onPointerEnter = (
    event: PointerEvent
  ): void => {
    this.#cancelHover();
    this.#cancelHoverClose();
    if (
      !this.#options.openOnHover ||
      event.pointerType === "touch"
    ) {
      return;
    }

    const anchor = this.#options.anchor();
    const popover = this.#options.popover();
    if (
      !(anchor instanceof HTMLElement) ||
      !popover ||
      anchor.matches(":disabled") ||
      popover.matches(":popover-open")
    ) {
      return;
    }

    const open = (): void => {
      this.#hoverTimer = null;
      if (anchor.isConnected && popover.isConnected &&
        this.#options.anchor() === anchor &&
        this.#options.popover() === popover &&
        !anchor.matches(":disabled")) {
        this.show();
        if (popover.matches(":popover-open")) {
          document.addEventListener("click", this.#onTriggerClick, true);
        }
      }
    };
    const delay = this.#options.openOnHover?.delay ?? kDefaultHoverDelay;
    if (delay <= 0) {
      open();
    }
    else {
      this.#hoverTimer = setTimeout(open, delay);
    }
  };

  onPointerLeave = (
    event: PointerEvent
  ): void => {
    this.#cancelHover();
    this.#cancelHoverClose();
    if (
      !this.#options.closeOnHoverLeave ||
      event.pointerType === "touch" ||
      this.#pinned
    ) {
      return;
    }

    const anchor = this.#options.anchor();
    const popover = this.#options.popover();
    const target = event.relatedTarget;
    if (!popover?.matches(":popover-open") ||
      (target instanceof Element && (
        popover.contains(target) ||
        (anchor instanceof HTMLElement && anchor.contains(target))
      ))) {
      return;
    }

    const close = (): void => {
      this.#hoverCloseTimer = null;
      if (this.#options.popover() === popover && popover.isConnected &&
        popover.matches(":popover-open") &&
        (!popover.matches(":focus-within") || this.#pointerInteraction)) {
        this.hide();
      }
    };
    const delay = this.#options.closeOnHoverLeave?.delay ??
      kDefaultHoverCloseDelay;
    if (delay <= 0) {
      close();
    }
    else {
      this.#hoverCloseTimer = setTimeout(close, delay);
    }
  };

  onBeforeToggle = (
    event: ToggleEvent
  ): void => {
    this.#cancelHover();
    this.#cancelHoverClose();
    if (event.newState === "open") {
      this.#activePopover = this.#options.popover();
      const anchor = this.#options.anchor();
      this.#activeAnchor = anchor instanceof HTMLElement ? anchor : null;
      if (this.#options.claimsInput !== false) {
        this.#claimInput();
      }
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
    if (event.currentTarget instanceof HTMLElement &&
      event.currentTarget !== this.#options.popover()) {
      return;
    }
    this.#open = event.newState === "open";
    this.#pointerInteraction = false;

    if (this.#open) {
      this.reposition();
      this.#listen();
      this.#options.onOpen?.();
    }
    else {
      this.#activePopover = null;
      this.#activeAnchor = null;
      this.#unlisten();
      this.#endHoverOpen();
      this.#options.onClose?.();

      const anchor = this.#options.anchor();
      if (this.#restoreFocus && anchor instanceof HTMLElement) {
        anchor.focus();
      }
    }

    this.#host.requestUpdate();
  };

  show(): void {
    this.#cancelHover();
    this.#cancelHoverClose();
    this.#options.popover()?.showPopover();
    this.reposition();
  }

  hide(): void {
    this.#cancelHover();
    this.#cancelHoverClose();
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
      side: typeof this.#options.side === "function" ?
        this.#options.side() : this.#options.side,
      align: this.#options.align
    }));
    this.#options.onReposition?.();
  }

  hostUpdated(): void {
    const popover = this.#activePopover;
    if (!popover || (
      popover === this.#options.popover() &&
      popover.matches(":popover-open") &&
      (!this.#activeAnchor || this.#activeAnchor === this.#options.anchor())
    )) {
      return;
    }

    this.#cancelHover();
    this.#cancelHoverClose();
    this.#unlisten();
    this.#endHoverOpen();
    this.#activePopover = null;
    this.#activeAnchor = null;
    const wasOpen = this.#open;
    this.#open = false;

    if (
      popover.isConnected &&
      popover.matches(":popover-open")
    ) {
      popover.hidePopover();
    }

    if (wasOpen) {
      this.#options.onClose?.();
      this.#host.requestUpdate();
    }
  }

  hostDisconnected(): void {
    this.#cancelHover();
    this.#cancelHoverClose();
    this.#unlisten();
    this.#endHoverOpen();
    this.#activePopover = null;
    this.#activeAnchor = null;
    this.#open = false;
  }

  #cancelHover(): void {
    if (this.#hoverTimer !== null) {
      clearTimeout(this.#hoverTimer);
      this.#hoverTimer = null;
    }
  }

  #cancelHoverClose(): void {
    if (this.#hoverCloseTimer !== null) {
      clearTimeout(this.#hoverCloseTimer);
      this.#hoverCloseTimer = null;
    }
  }

  #endHoverOpen(): void {
    document.removeEventListener("click", this.#onTriggerClick, true);
    this.#pinned = false;
  }

  readonly #onTriggerClick = (
    event: MouseEvent
  ): void => {
    const anchor = this.#options.anchor();
    if (
      !(anchor instanceof HTMLElement) ||
      !event.composedPath().includes(anchor) ||
      !this.#options.popover()?.matches(":popover-open")
    ) {
      return;
    }

    event.preventDefault();
    this.#cancelHoverClose();
    document.removeEventListener("click", this.#onTriggerClick, true);
    this.#pinned = true;
  };

  readonly #onReposition = (): void => {
    this.reposition();
  };

  readonly #onPointerDown = (): void => {
    this.#pointerInteraction = true;
  };

  readonly #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    this.#pointerInteraction = false;
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
    document.addEventListener(
      "pointerdown",
      this.#onPointerDown,
      true
    );
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
    document.removeEventListener(
      "pointerdown",
      this.#onPointerDown,
      true
    );
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
