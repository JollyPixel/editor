// Import Internal Dependencies
import type { ToolControllers } from "../tools/ToolControllers.ts";
import type { CanvasRenderer } from "../rendering/CanvasRenderer.ts";
import type { SvgManager } from "../rendering/SvgManager.ts";
import type { Viewport } from "../rendering/Viewport.ts";
import type { Mode } from "../types.ts";
import type { InputActions } from "./InputController.ts";

export interface CreateInputActionsOptions {
  getMode: () => Mode;
  renderer: CanvasRenderer;
  svgManager: SvgManager;
  viewport: Viewport;
  tools: ToolControllers;
  /** Cancels the active primary drag without calling `onPrimaryUp`. */
  stopDrawing: () => void;
}

/**
 * Routes mode-agnostic input actions from `InputController` to the active
 * tool controller.
 */
export function createInputActions(
  options: CreateInputActionsOptions
): Omit<InputActions, "onUndo" | "onRedo"> {
  const {
    getMode,
    renderer,
    svgManager,
    viewport,
    tools,
    stopDrawing
  } = options;

  return {
    onPrimaryDown: (tx, ty) => {
      switch (getMode()) {
        case "paint":
          if (tools.brush.pickArmed) {
            tools.brush.pick(tx, ty);

            return false;
          }

          if (
            tools.line.isArmed &&
            tools.line.commitTrigger === "mousedown"
          ) {
            tools.line.commit();

            return false;
          }

          if (tools.brush.isActive === "secondary") {
            return false;
          }

          tools.brush.startStroke(tx, ty, "primary");

          return true;

        case "fill":
          tools.fill.run(tx, ty, "primary");

          return false;

        case "select":
          tools.select.handleStart({ x: tx, y: ty });

          return true;

        default:
          return false;
      }
    },
    onSecondaryDown: (tx, ty, ctrlKey) => {
      const mode = getMode();

      if (mode === "fill") {
        tools.fill.run(tx, ty, "secondary");

        return false;
      }

      if (mode !== "paint") {
        return false;
      }

      if (ctrlKey) {
        tools.brush.pick(tx, ty);

        return false;
      }

      if (tools.brush.isActive === "primary") {
        return false;
      }

      tools.brush.startStroke(tx, ty, "secondary");

      return true;
    },
    onSecondaryMove: (tx, ty) => {
      if (getMode() === "paint") {
        tools.brush.continueStroke(tx, ty);
      }
    },
    onSecondaryUp: () => {
      if (getMode() === "paint") {
        tools.brush.endStroke();
      }
    },
    onPrimaryMove: (tx, ty) => {
      switch (getMode()) {
        case "paint":
          tools.brush.continueStroke(tx, ty);
          break;

        case "select":
          tools.select.handleMove({ x: tx, y: ty });
          break;

        default:
      }
    },
    onPrimaryUp: () => {
      switch (getMode()) {
        case "paint":
          tools.brush.endStroke();
          break;

        case "select":
          tools.select.handleEnd();
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
      tools.line.refreshPreview();
      tools.select.refreshOverlay();
    },
    onPanEnd: () => {
      // No-op. The viewport handles panning internally.
    },
    onZoom: (delta, cx, cy) => {
      viewport.applyZoom(delta, cx, cy);
      renderer.drawFrame();
      tools.line.refreshPreview();
      tools.select.refreshOverlay();
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
      tools.line.updateCursor(pos);
    },
    onMouseUp: () => {
      if (
        tools.line.isArmed &&
        tools.line.commitTrigger === "mouseup"
      ) {
        tools.line.commit();
      }
    },
    onShiftDown: () => {
      tools.line.shiftHeld = true;
      if (getMode() !== "paint") {
        return;
      }

      if (tools.brush.isActive === "primary") {
        // A held pointer requires committing the line on mouseup.
        stopDrawing();
        tools.brush.endStroke();
        tools.line.arm("mouseup");

        return;
      }

      if (tools.brush.isActive === "secondary") {
        // The line tool only ever draws in the primary color; let the
        // secondary-color drag keep painting uninterrupted.
        return;
      }

      tools.line.arm("mousedown");
    },
    onShiftUp: () => {
      tools.line.shiftHeld = false;
      tools.line.cancelIfArmed();
    },
    onBlur: () => {
      tools.line.shiftHeld = false;
      tools.line.cancelIfArmed();
    },
    onCopy: () => tools.select.handleCopy(),
    onPaste: () => tools.select.handlePaste(),
    onDelete: () => tools.select.handleDelete(),
    onRotate: () => tools.select.handleRotate(),
    onFlipHorizontal: () => tools.select.handleFlipHorizontal(),
    onFlipVertical: () => tools.select.handleFlipVertical()
  };
}
