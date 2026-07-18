// Import Internal Dependencies
import type { Brush } from "../tools/Brush.ts";
import type { BrushController } from "../tools/BrushController.ts";
import type { CanvasBuffer } from "../buffer/CanvasBuffer.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { FillController } from "../tools/FillController.ts";
import type { LineController } from "../tools/LineController.ts";
import type { SelectController } from "../tools/SelectController.ts";
import type { SvgManager } from "../rendering/SvgManager.ts";
import type { Viewport } from "../rendering/Viewport.ts";
import { rgbToHex } from "../utils/colors.ts";
import type { Mode } from "../types.ts";
import type { InputActions } from "./InputController.ts";

export interface CreateInputActionsOptions {
  getMode: () => Mode;
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  renderer: CanvasRenderer;
  svgManager: SvgManager;
  viewport: Viewport;
  brushController: BrushController;
  fillController: FillController;
  lineController: LineController;
  selectController: SelectController;
  undo: () => boolean;
  redo: () => boolean;
  /** Cancels the active primary drag without calling `onPrimaryUp`. */
  stopDrawing: () => void;
}

/**
 * Routes mode-agnostic input actions from `InputController` to the active
 * tool controller.
 */
export function createInputActions(
  options: CreateInputActionsOptions
): InputActions {
  const {
    getMode,
    brush,
    canvasBuffer,
    renderer,
    svgManager,
    viewport,
    brushController,
    fillController,
    lineController,
    selectController,
    undo,
    redo,
    stopDrawing
  } = options;

  return {
    onPrimaryDown: (tx, ty) => {
      switch (getMode()) {
        case "paint":
          if (
            lineController.isArmed &&
            lineController.commitTrigger === "mousedown"
          ) {
            lineController.commit();

            return false;
          }

          brushController.startStroke(tx, ty);

          return true;

        case "fill":
          fillController.run(tx, ty);

          return false;

        case "select":
          selectController.handleStart({ x: tx, y: ty });

          return true;

        default:
          return false;
      }
    },
    onPrimaryMove: (tx, ty) => {
      switch (getMode()) {
        case "paint":
          brushController.continueStroke(tx, ty);
          break;

        case "select":
          selectController.handleMove({ x: tx, y: ty });
          break;

        default:
      }
    },
    onPrimaryUp: () => {
      switch (getMode()) {
        case "paint":
          brushController.endStroke();
          break;

        case "select":
          selectController.handleEnd();
          break;

        default:
      }
    },
    onPanStart: (_mx, _my) => {
      // No-op. The viewport handles panning internally.
    },
    onPanMove: (dx, dy) => {
      viewport.applyPan(dx, dy);
      renderer.drawFrame();
      lineController.refreshPreview();
      selectController.refreshOverlay();
    },
    onPanEnd: () => {
      // No-op. The viewport handles panning internally.
    },
    onZoom: (delta, cx, cy) => {
      viewport.applyZoom(delta, cx, cy);
      renderer.drawFrame();
      lineController.refreshPreview();
      selectController.refreshOverlay();
    },
    onColorPick: (tx, ty) => {
      const mode = getMode();
      if (mode !== "paint" && mode !== "fill") {
        return;
      }

      const [r, g, b, a] = canvasBuffer.samplePixel(tx, ty);
      const hex = rgbToHex(r, g, b);
      const opacity = a / 255;
      brush.color(hex, opacity);

      const event = new CustomEvent("colorpicked", {
        detail: { hex, opacity },
        bubbles: true,
        composed: true
      });
      renderer.canvas().dispatchEvent(event);
    },
    onMouseMove: (cx, cy) => {
      if (cx < 0 || cy < 0) {
        svgManager.brushHighlight.update(null, null);

        return;
      }

      const mode = getMode();
      if (mode === "paint" || mode === "fill") {
        svgManager.brushHighlight.update(cx, cy);
      }
    },
    onCursorMove: (pos) => {
      lineController.updateCursor(pos);
    },
    onMouseUp: () => {
      if (
        lineController.isArmed &&
        lineController.commitTrigger === "mouseup"
      ) {
        lineController.commit();
      }
    },
    onShiftDown: () => {
      lineController.shiftHeld = true;
      if (getMode() !== "paint") {
        return;
      }

      if (brushController.isActive) {
        // A held pointer requires committing the line on mouseup.
        stopDrawing();
        brushController.endStroke();
        lineController.arm("mouseup");

        return;
      }

      lineController.arm("mousedown");
    },
    onShiftUp: () => {
      lineController.shiftHeld = false;
      lineController.cancelIfArmed();
    },
    onBlur: () => {
      lineController.shiftHeld = false;
      lineController.cancelIfArmed();
    },
    onCopy: () => selectController.handleCopy(),
    onPaste: () => selectController.handlePaste(),
    onDelete: () => selectController.handleDelete(),
    onUndo: () => undo(),
    onRedo: () => redo(),
    onRotate: () => selectController.handleRotate(),
    onFlipHorizontal: () => selectController.handleFlipHorizontal(),
    onFlipVertical: () => selectController.handleFlipVertical()
  };
}
