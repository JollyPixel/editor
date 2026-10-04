// Import Internal Dependencies
import type { Viewport } from "../rendering/Viewport.ts";
import type { BrushColorSlot } from "../tools/Brush.ts";
import type { Vec2 } from "../types.ts";
import type {
  InputActions,
  PointerPosition
} from "./InputActions.ts";
import type { WindowLike } from "./WindowLike.ts";

// CONSTANTS
const kAuxiliaryButton = 1;

const kButtonSlots: ReadonlyMap<number, BrushColorSlot> = new Map([
  [0, "primary"],
  [2, "secondary"]
]);

const kSlotButtonMasks: Record<BrushColorSlot, number> = {
  primary: 1,
  secondary: 2
};

const kWheelDeltaMode = {
  pixel: 0,
  line: 1,
  page: 2
} as const;

// Approximate CSS-pixel equivalents for line and page wheel deltas.
const kWheelLineDeltaPixels = 16;
const kWheelPageDeltaPixels = 100;

export interface PointerControllerOptions {
  canvas: HTMLCanvasElement;
  viewport: Viewport;
  actions: InputActions;
  /**
   * Global event target.
   * @default window
   */
  window?: WindowLike;
}

export class PointerController {
  #canvas: HTMLCanvasElement;
  #viewport: Viewport;
  #actions: InputActions;
  #inputWindow: WindowLike;
  #panAnchor: Vec2 | null = null;
  #dragging: BrushColorSlot | null = null;

  constructor(
    options: PointerControllerOptions
  ) {
    const {
      canvas,
      viewport,
      actions,
      window: inputWindow = window
    } = options;

    this.#canvas = canvas;
    this.#viewport = viewport;
    this.#actions = actions;
    this.#inputWindow = inputWindow;

    this.#addEventListeners();
  }

  destroy(): void {
    this.#removeEventListeners();
  }

  #addEventListeners(): void {
    this.#canvas.addEventListener("mousedown", this.#handleMouseDown);
    this.#canvas.addEventListener("mousemove", this.#handleMouseMove);
    this.#canvas.addEventListener("mouseleave", this.#handleMouseLeave);
    this.#canvas.addEventListener("mouseup", this.#handleMouseUp);
    this.#canvas.addEventListener("wheel", this.#handleWheel, { passive: false });
    this.#canvas.addEventListener("contextmenu", this.#handleContextMenu);
    this.#inputWindow.addEventListener("mousemove", this.#handleWindowMouseMove);
    this.#inputWindow.addEventListener("mouseup", this.#handleWindowMouseUp);
    this.#inputWindow.addEventListener("blur", this.#handleWindowBlur);
  }

  #removeEventListeners(): void {
    this.#canvas.removeEventListener("mousedown", this.#handleMouseDown);
    this.#canvas.removeEventListener("mousemove", this.#handleMouseMove);
    this.#canvas.removeEventListener("mouseleave", this.#handleMouseLeave);
    this.#canvas.removeEventListener("mouseup", this.#handleMouseUp);
    this.#canvas.removeEventListener("wheel", this.#handleWheel);
    this.#canvas.removeEventListener("contextmenu", this.#handleContextMenu);
    this.#inputWindow.removeEventListener("mousemove", this.#handleWindowMouseMove);
    this.#inputWindow.removeEventListener("mouseup", this.#handleWindowMouseUp);
    this.#inputWindow.removeEventListener("blur", this.#handleWindowBlur);
  }

  #positionOf(
    event: MouseEvent
  ): PointerPosition {
    const bounds = this.#canvas.getBoundingClientRect();
    const { clientX, clientY } = event;
    const texture = this.#viewport.mouseTexturePosition(
      clientX,
      clientY,
      { bounds }
    );

    return {
      canvas: {
        x: clientX - bounds.left,
        y: clientY - bounds.top
      },
      texture,
      boundedTexture: this.#viewport.texture.contains(texture) ?
        { ...texture } :
        null
    };
  }

  #isHeld(
    slot: BrushColorSlot,
    event: MouseEvent
  ): boolean {
    return (event.buttons & kSlotButtonMasks[slot]) !== 0;
  }

  #endDrag(): void {
    const slot = this.#dragging;
    if (slot === null) {
      return;
    }

    this.#dragging = null;
    this.#actions.onPointerUp(slot);
  }

  #release(
    event: MouseEvent
  ): void {
    if (
      this.#dragging !== null &&
      kButtonSlots.get(event.button) === this.#dragging
    ) {
      this.#endDrag();
    }
    this.#actions.onMouseUp();
  }

  #beginPan(
    event: MouseEvent
  ): void {
    this.#panAnchor = {
      x: event.clientX,
      y: event.clientY
    };
    this.#actions.onPanStart();
  }

  #endPan(): void {
    if (this.#panAnchor === null) {
      return;
    }

    this.#panAnchor = null;
    this.#actions.onPanEnd();
  }

  #handleMouseDown = (
    event: MouseEvent
  ): void => {
    if (event.button === kAuxiliaryButton) {
      this.#beginPan(event);

      return;
    }

    const slot = kButtonSlots.get(event.button);
    if (slot === undefined) {
      return;
    }
    if (slot === "primary" && this.#actions.pansOnPrimary) {
      this.#beginPan(event);

      return;
    }
    if (this.#dragging !== null) {
      if (this.#isHeld(this.#dragging, event)) {
        return;
      }
      this.#endDrag();
    }

    if (this.#actions.onPointerDown(slot, this.#positionOf(event), event.ctrlKey)) {
      this.#dragging = slot;
    }
  };

  #handleMouseMove = (
    event: MouseEvent
  ): void => {
    event.preventDefault();

    const position = this.#positionOf(event);
    this.#actions.onHover(position);

    if (
      this.#dragging !== null &&
      this.#isHeld(this.#dragging, event)
    ) {
      this.#actions.onPointerMove(this.#dragging, position);
    }
  };

  #handleMouseLeave = (): void => {
    this.#actions.onHover(null);
  };

  #handleMouseUp = (
    event: MouseEvent
  ): void => {
    this.#release(event);
  };

  #normalizeWheelDelta(
    event: WheelEvent
  ): number {
    switch (event.deltaMode) {
      case kWheelDeltaMode.line:
        return event.deltaY * kWheelLineDeltaPixels;
      case kWheelDeltaMode.page:
        return event.deltaY * kWheelPageDeltaPixels;
      case kWheelDeltaMode.pixel:
      default:
        return event.deltaY;
    }
  }

  #handleWheel = (
    event: WheelEvent
  ): void => {
    event.preventDefault();

    const delta = this.#normalizeWheelDelta(
      event
    );
    if (event.ctrlKey && this.#actions.onCtrlWheel(delta)) {
      return;
    }

    const position = this.#positionOf(event);
    this.#viewport.applyZoom(
      delta,
      position.canvas.x,
      position.canvas.y
    );
    this.#actions.onHover(position);
  };

  #handleContextMenu = (
    event: MouseEvent
  ): void => {
    event.preventDefault();
  };

  #handleWindowMouseMove = (
    event: MouseEvent
  ): void => {
    if (this.#panAnchor === null) {
      if (
        event.target !== this.#canvas &&
        this.#dragging !== null &&
        this.#isHeld(this.#dragging, event)
      ) {
        this.#actions.onPointerMove(
          this.#dragging,
          this.#positionOf(event)
        );
      }

      return;
    }

    const dx = event.clientX - this.#panAnchor.x;
    const dy = event.clientY - this.#panAnchor.y;
    this.#panAnchor = {
      x: event.clientX,
      y: event.clientY
    };
    this.#viewport.applyPan(dx, dy);
  };

  #handleWindowMouseUp = (
    event: MouseEvent
  ): void => {
    this.#endPan();

    if (event.target === this.#canvas) {
      return;
    }

    this.#release(event);
  };

  #handleWindowBlur = (): void => {
    this.#endPan();
    this.#endDrag();
    this.#actions.onBlur();
  };
}
