// Import Internal Dependencies
import { copyTheme } from "./dragGhost.ts";

// CONSTANTS
const kOverlayClass = "jolly-drag-overlay";
const kInsertionClass = "jolly-drag-insertion";
const kGhostClass = "jolly-drag-ghost";
const kZoneClass = "jolly-drag-zone";
const kArmedClass = "jolly-drag-zone-armed";
const kTopLayer = "2147483646";
const kZoneFade = 120;

/*
 * A zone is a wash and nothing else: no border, no radius. It covers a whole
 * dock, and an outline around something that large reads as a box drawn over
 * the layout rather than as the layout offering to take something.
 *
 * The wash is the accent, which is the colour a dock already tints itself with
 * when it is being resized, but at a fainter stop: a zone covers a whole dock
 * rather than a handle. The armed zone is the same wash one step up, which is
 * the whole of the difference between a dock on offer and the one about to
 * take the drop.
 */
const kIdleZone = {
  background: "var(--jolly-dock-zone-bg, rgb(47 111 216 / 0.06))"
};

const kArmedZone = {
  background: "var(--jolly-dock-zone-bg-armed, rgb(47 111 216 / 0.1))"
};

/*
 * The insertion line is neutral for the same reason the zones are: it lands as
 * often on an accent-filled pane header as on a plain row, and an accent line
 * on accent chrome is no line at all. Muted ink rather than full ink keeps it
 * from reading as a hard rule ruled through the layout, and the ring in the
 * surface behind it is what carries it over any fill it happens to cross.
 */
const kInsertion = {
  background: "var(--jolly-text-muted, rgb(90 98 112))",
  borderRadius: "999px",
  boxShadow: [
    "0 0 0 1px var(--jolly-surface, rgb(255 255 255 / 0.9))",
    "0 1px 4px rgb(0 0 0 / 0.28)"
  ].join(", ")
};

/**
 * Client-space rectangle, in CSS pixels.
 */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  /** Paints the bands that arm a container while a drag is running. */
  showZones(
    zones: readonly Rect[]
  ): void;
  /**
   * Raises the zone the pointer has armed, by index into the last `showZones`,
   * or lowers them all for `null`.
   */
  armZone(
    index: number | null
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

/**
 * Builds the fallback ghost, for a caller that supplies no element of its own.
 *
 * A flat accent block with the label on it: enough to show that something is
 * being carried, and no imitation of any particular container.
 */
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

/**
 * Creates the document-level visuals for a pane or folder drag.
 *
 * Lives in `document.body` and therefore outside any theme scope host. The
 * bands and the insertion line take colours already resolved by the caller;
 * `scope` is what lets a cloned `element` resolve the rest for itself.
 */
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
    // Only a replica needs lifting off the page: the chip is already a solid
    // block of accent, and reads as carried without one.
    ghost.style.boxShadow = "var(--jolly-shadow-floating, 0 4px 16px rgb(0 0 0 / 0.3))";
  }

  root.append(insertion, ghost);
  document.body.append(root);

  const bands: HTMLElement[] = [];

  return {
    showZones(
      zones: readonly Rect[]
    ): void {
      for (const band of bands) {
        band.remove();
      }
      bands.length = 0;

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
        // Zones appear the instant a drag begins, all of them at once. Fading
        // them in is what keeps that from reading as the layout flinching.
        band.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: kZoneFade, easing: "ease-out" }
        );
        bands.push(band);
        root.prepend(band);
      }
    },

    armZone(
      index: number | null
    ): void {
      for (let position = 0; position < bands.length; position++) {
        const band = bands[position];
        const armed = position === index;
        band.classList.toggle(kArmedClass, armed);
        Object.assign(band.style, armed ? kArmedZone : kIdleZone);
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
