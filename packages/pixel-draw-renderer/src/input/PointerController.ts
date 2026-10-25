// Import Internal Dependencies
import { EdgePan } from "./EdgePan.ts";
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

const kWheelLineDeltaPixels = 16;
const kWheelPageDeltaPixels = 100;
const kPinchDeltaPerScaleLog = 100;

type ClientPoint = Pick<MouseEvent, "clientX" | "clientY">;

interface Drag {
  slot: BrushColorSlot;
  pointer: ClientPoint;
}

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
  #drag: Drag | null = null;
  #edgePan: EdgePan;
  #controlHeld = false;

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
    this.#edgePan = new EdgePan({ viewport });

    this.#addEventListeners();
  }

  destroy(): void {
    this.#edgePan.stop();
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
    this.#inputWindow.addEventListener("keydown", this.#handleWindowKey);
    this.#inputWindow.addEventListener("keyup", this.#handleWindowKey);
    this.#inputWindow.addEventListener("blur", this.#handleWindowBlur);
    this.#viewport.on("changed", this.#handleViewportChanged);
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
    this.#inputWindow.removeEventListener("keydown", this.#handleWindowKey);
    this.#inputWindow.removeEventListener("keyup", this.#handleWindowKey);
    this.#inputWindow.removeEventListener("blur", this.#handleWindowBlur);
    this.#viewport.off("changed", this.#handleViewportChanged);
  }

  #toPosition(
    event: ClientPoint
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

  #heldDrag(
    event: MouseEvent
  ): Drag | null {
    const drag = this.#drag;

    return drag !== null && this.#isHeld(drag.slot, event) ? drag : null;
  }

  #endDrag(): void {
    const drag = this.#drag;
    if (drag === null) {
      return;
    }

    this.#drag = null;
    this.#edgePan.stop();
    this.#actions.onPointerUp(drag.slot);
  }

  #dragTo(
    drag: Drag,
    event: MouseEvent,
    position: PointerPosition
  ): void {
    drag.pointer = clientPoint(event);
    this.#moveDrag(drag, position);
  }

  #moveDrag(
    drag: Drag,
    position: PointerPosition
  ): void {
    this.#actions.onPointerMove(drag.slot, position);

    if (this.#panAnchor === null && this.#actions.edgePans) {
      this.#edgePan.aim(position.canvas);
    }
  }

  #release(
    event: MouseEvent
  ): void {
    if (
      this.#drag !== null &&
      kButtonSlots.get(event.button) === this.#drag.slot
    ) {
      this.#endDrag();
    }
    this.#actions.onMouseUp();
  }

  #beginPan(
    event: MouseEvent
  ): void {
    this.#edgePan.stop();
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
    this.#controlHeld = event.ctrlKey;
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
    if (this.#drag !== null) {
      if (this.#isHeld(this.#drag.slot, event)) {
        return;
      }
      this.#endDrag();
    }

    if (this.#actions.onPointerDown(slot, this.#toPosition(event), event.ctrlKey)) {
      this.#drag = {
        slot,
        pointer: clientPoint(event)
      };
    }
  };

  #handleMouseMove = (
    event: MouseEvent
  ): void => {
    event.preventDefault();
    this.#controlHeld = event.ctrlKey;

    const position = this.#toPosition(event);
    this.#actions.onHover(position);

    const drag = this.#heldDrag(event);
    if (drag !== null) {
      this.#dragTo(drag, event, position);
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
    const pinch = event.ctrlKey && !this.#controlHeld;
    if (
      event.ctrlKey &&
      !pinch &&
      this.#actions.onCtrlWheel(delta)
    ) {
      return;
    }

    const position = this.#toPosition(event);
    if (pinch) {
      this.#viewport.applyScale(
        Math.exp(-delta / kPinchDeltaPerScaleLog),
        position.canvas.x,
        position.canvas.y
      );
    }
    else {
      this.#viewport.applyZoom(
        delta,
        position.canvas.x,
        position.canvas.y
      );
    }
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
      const drag = this.#heldDrag(event);
      if (event.target !== this.#canvas && drag !== null) {
        this.#dragTo(drag, event, this.#toPosition(event));
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

  #handleWindowKey = (
    event: KeyboardEvent
  ): void => {
    this.#controlHeld = event.ctrlKey;
  };

  #handleViewportChanged = (): void => {
    const drag = this.#drag;
    if (drag !== null) {
      this.#moveDrag(drag, this.#toPosition(drag.pointer));
    }
  };

  #handleWindowBlur = (): void => {
    this.#controlHeld = false;
    this.#endPan();
    this.#endDrag();
    this.#actions.onBlur();
  };
}

function clientPoint(
  event: MouseEvent
): ClientPoint {
  return {
    clientX: event.clientX,
    clientY: event.clientY
  };
}
