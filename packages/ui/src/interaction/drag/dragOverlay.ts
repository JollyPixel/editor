// Import Internal Dependencies
import { copyTheme } from "./dragGhost.ts";
import type { Rect } from "../../geometry/Rect.ts";

// CONSTANTS
const kOverlayClass = "jolly-drag-overlay";
const kInsertionClass = "jolly-drag-insertion";
const kGhostClass = "jolly-drag-ghost";
const kZoneClass = "jolly-drag-zone";
const kArmedClass = "jolly-drag-zone-armed";
const kTopLayer = "2147483646";
const kZoneFade = 120;

const kIdleZone = {
  background: "var(--jolly-dock-zone-bg, rgb(47 111 216 / 0.06))"
};

const kArmedZone = {
  background: "var(--jolly-dock-zone-bg-armed, rgb(47 111 216 / 0.1))"
};

const kInsertion = {
  background: "var(--jolly-text-muted, rgb(90 98 112))",
  borderRadius: "999px",
  boxShadow: [
    "0 0 0 1px var(--jolly-surface, rgb(255 255 255 / 0.9))",
    "0 1px 4px rgb(0 0 0 / 0.28)"
  ].join(", ")
};

export interface DragOverlayOptions {
  accent: string;
  label: string;
  /** Trails the cursor with a label chip. */
  ghost?: boolean;
  /**
   * Carried in place of the label chip, normally a header-only clone of the
   * dragged container. Styled by the overlay only where it has to be: position,
   * width and lift. Everything it paints is its own.
   */
  element?: HTMLElement | null;
  /**
   * Element to read the theme from, normally the drag source. Without one the
   * overlay declares no tokens and `element` falls back to its usage-site
   * defaults.
   */
  scope?: HTMLElement;
  /** Ghost width, normally the source rect. The chip also uses `height`. */
  width: number;
  height: number;
}

export interface DragOverlay {
  showZones(
    zones: readonly Rect[]
  ): void;
  armZone(
    index: number | null,
    preview?: Rect
  ): void;
  showInsertion(
    rect: Rect
  ): void;
  hideInsertion(): void;
  moveGhost(
    x: number,
    y: number
  ): void;
  destroy(): void;
}

function labelChip(
  options: DragOverlayOptions
): HTMLElement {
  const chip = document.createElement("div");
  chip.textContent = options.label;
  Object.assign(chip.style, {
    display: "flex",
    alignItems: "center",
    height: `${options.height}px`,
    padding: "0 8px",
    border: `1px solid ${options.accent}`,
    borderRadius: "3px",
    background: options.accent,
    color: "white",
    font: "inherit",
    letterSpacing: "0.08em",
    overflow: "hidden",
    whiteSpace: "nowrap"
  });

  return chip;
}

export function createDragOverlay(
  options: DragOverlayOptions
): DragOverlay {
  const root = document.createElement("div");
  root.className = kOverlayClass;
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    pointerEvents: "none",
    zIndex: kTopLayer
  });
  if (options.scope !== undefined) {
    copyTheme(options.scope, root);
  }

  const insertion = document.createElement("div");
  insertion.className = kInsertionClass;
  Object.assign(insertion.style, {
    position: "fixed",
    display: "none",
    ...kInsertion
  });

  const ghost = options.element ?? labelChip(options);
  ghost.classList.add(kGhostClass);
  Object.assign(ghost.style, {
    position: "fixed",
    boxSizing: "border-box",
    width: `${options.width}px`,
    opacity: "0.85",
    pointerEvents: "none"
  });
  if (options.ghost === false) {
    ghost.style.display = "none";
  }
  else if (
    options.element !== undefined &&
    options.element !== null
  ) {
    ghost.style.boxShadow = "var(--jolly-shadow-floating, 0 4px 16px rgb(0 0 0 / 0.3))";
  }

  root.append(insertion, ghost);
  document.body.append(root);

  const bands: HTMLElement[] = [];
  const rects: Rect[] = [];

  return {
    showZones(
      zones: readonly Rect[]
    ): void {
      for (const band of bands) {
        band.remove();
      }
      bands.length = 0;
      rects.length = 0;

      for (const zone of zones) {
        const band = document.createElement("div");
        band.className = kZoneClass;
        Object.assign(band.style, {
          position: "fixed",
          left: `${zone.x}px`,
          top: `${zone.y}px`,
          width: `${zone.width}px`,
          height: `${zone.height}px`,
          transition:
            `background-color ${kZoneFade}ms var(--jolly-easing, ease)`,
          ...kIdleZone
        });
        band.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: kZoneFade, easing: "ease-out" }
        );
        bands.push(band);
        rects.push(zone);
        root.prepend(band);
      }
    },

    armZone(
      index: number | null,
      preview?: Rect
    ): void {
      for (let position = 0; position < bands.length; position++) {
        const band = bands[position];
        const armed = position === index;
        const rect = armed && preview !== undefined ?
          preview :
          rects[position];
        band.classList.toggle(kArmedClass, armed);
        Object.assign(band.style, armed ? kArmedZone : kIdleZone, {
          left: `${rect.x}px`,
          top: `${rect.y}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`
        });
      }
    },

    showInsertion(
      rect: Rect
    ): void {
      Object.assign(insertion.style, {
        display: "block",
        left: `${rect.x}px`,
        top: `${rect.y}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      });
    },

    hideInsertion(): void {
      insertion.style.display = "none";
    },

    moveGhost(
      x: number,
      y: number
    ): void {
      ghost.style.left = `${x}px`;
      ghost.style.top = `${y}px`;
    },

    destroy(): void {
      root.remove();
    }
  };
}
