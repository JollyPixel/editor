// Import Internal Dependencies
import {
  createDragOverlay,
  type DragOverlay
} from "./dragOverlay.ts";
import type { Rect } from "../../geometry/Rect.ts";
import {
  resolveDropIndex,
  type DropCandidate
} from "./dropIndex.ts";
import { ensureDocumentStyles } from "../ensureDocumentStyles.ts";
import { kFallback } from "../../theme/fallbacks.ts";
import { resolveThemeToken } from "../../theme/resolveThemeToken.ts";

// CONSTANTS
const kThreshold = 4;
const kDeadBand = 6;
const kDraggingClass = "jolly-pane-dragging";
const kInsertionThickness = 2;
const kEnterDepth = 48;
const kChipOffset = 12;
const kChipHeight = 22;

/**
 * A container that can receive the dragged element.
 */
export interface DragZone {
  /** Caller-owned identifier, returned untouched in the result. */
  id: string;
  /** Region that arms this zone when the pointer enters it. */
  rect: Rect;
  /** Existing children, ordered along `axis`. */
  candidates: DropCandidate[];
  axis: "x" | "y";
  /**
   * Index the dragged element already occupies among `candidates`, or `null`
   * when it lives elsewhere. Dropping on either side of itself moves nothing,
   * so no line is painted there.
   */
  source?: number | null;
  /** Client rect of the insertion line for an index. */
  line(
    index: number
  ): Rect;
}

export interface DragResult {
  /** Armed zone, or `null` when the pointer sits over none. */
  zone: DragZone | null;
  /**
   * Insertion index into the zone's current children, counting the dragged
   * element if it already lives there. Callers that move a child within one
   * zone must account for its removal.
   */
  index: number;
  x: number;
  y: number;
}

export interface DragSessionOptions {
  source: HTMLElement;
  /** The `pointerdown` that opened the session. */
  event: PointerEvent;
  /** Element that keeps pointer capture; defaults to `source`. */
  handle?: HTMLElement;
  /** Resolved once, when the drag passes the threshold. */
  zones(): DragZone[];
  /**
   * Box the gesture will occupy for a pointer position, asked on every move.
   *
   * A zone the pointer misses still arms once this box has entered it deeply
   * enough. That is what makes a floating window dockable: the window is what
   * the eye follows, and its leading edge reaches a dock on the far side of
   * the screen long before the cursor does. It is the box the move is about to
   * produce, not the one on screen, because the element has yet to be moved
   * when the zone is resolved. Omit it when nothing but the cursor moves,
   * which keeps the drop strictly under the pointer.
   */
  probe?(
    clientX: number,
    clientY: number
  ): Rect | null;
  ghostLabel: string;
  /**
   * Paints zones, insertion line and ghost. Turn it off when the dragged
   * element follows the pointer itself, as a floating window does.
   */
  visuals?: boolean;
  /**
   * Paints the label chip that trails the cursor. Turn it off when the real
   * element already follows the pointer.
   */
  ghost?: boolean;
  /**
   * Builds what the cursor carries, in place of the label chip.
   *
   * Normally a header-only clone of the dragged container, which reads as the
   * thing being moved rather than as a chip standing for it. Called once, when
   * the drag passes the threshold, so a click that never became one builds
   * nothing. A replica is carried at the offset it was grabbed at, so it sits
   * where the source sat under the cursor; the chip has no such origin and
   * trails the pointer instead.
   */
  ghostElement?(): HTMLElement | null;
  threshold?: number;
  deadBand?: number;
  onStart?(): void;
  onPreview?(
    result: DragResult
  ): void;
  onCommit(
    result: DragResult
  ): void;
  /** Undoes whatever `onPreview` moved. Omit when the preview moved nothing. */
  onCancel?(): void;
  /**
   * Runs once on every release, including one below the movement threshold
   * that fires neither `onCommit` nor `onCancel`. Callers clear their session
   * handle here, so a click that never became a drag cannot block the next one.
   */
  onEnd?(): void;
}

export interface DragSessionHandle {
  cancel(): void;
}

/**
 * Runs one pointer drag of a pane or folder.
 *
 * Nothing is mutated while the pointer moves: the session resolves an armed
 * zone and an insertion index, paints them, and reports the final position
 * once through `onCommit`. A release below the movement threshold is a click,
 * so it reports no placement; `onEnd` still runs, and runs exactly once.
 */
export function startDragSession(
  options: DragSessionOptions
): DragSessionHandle {
  const {
    source,
    event,
    handle = source,
    zones,
    probe,
    ghostLabel,
    visuals = true,
    ghost = true,
    ghostElement,
    threshold = kThreshold,
    deadBand = kDeadBand,
    onStart,
    onPreview,
    onCommit,
    onCancel,
    onEnd
  } = options;

  const pointerId = event.pointerId;
  const originX = event.clientX;
  const originY = event.clientY;

  let started = false;
  let settled = false;
  let overlay: DragOverlay | null = null;
  let armed: DragZone[] = [];
  let current: number | null = null;
  let ghostX = -kChipOffset;
  let ghostY = -kChipOffset;
  let result: DragResult = {
    zone: null,
    index: 0,
    x: originX,
    y: originY
  };

  function begin(): void {
    started = true;
    armed = zones();
    if (visuals) {
      const rect = source.getBoundingClientRect();
      const element = ghost ? ghostElement?.() ?? null : null;
      // Nothing has moved yet, so the source still sits where it was grabbed
      // and the offset taken at pointerdown still holds.
      if (element !== null) {
        ghostX = originX - rect.x;
        ghostY = originY - rect.y;
      }

      overlay = createDragOverlay({
        accent: resolveThemeToken(
          source,
          "--jolly-accent-fill",
          String(kFallback.focusRing)
        ),
        label: ghostLabel,
        ghost,
        element,
        scope: source,
        width: element === null ? Math.max(rect.width, 120) : rect.width,
        height: kChipHeight
      });
      overlay.showZones(armed.map((zone) => zone.rect));
    }
    ensureSessionStyles();
    document.documentElement.classList.add(
      kDraggingClass
    );
    onStart?.();
  }

  function update(
    clientX: number,
    clientY: number
  ): void {
    const zone = armed.find(
      (candidate) => contains(candidate.rect, clientX, clientY)
    ) ?? entered(armed, probe?.(clientX, clientY) ?? null);

    overlay?.armZone(
      zone === null ? null : armed.indexOf(zone)
    );
    if (zone === null) {
      current = null;
      overlay?.hideInsertion();
    }
    else {
      const sameZone = result.zone !== null && result.zone.id === zone.id;
      current = resolveDropIndex({
        position: zone.axis === "y" ? clientY : clientX,
        candidates: zone.candidates,
        current: sameZone ? current : null,
        deadBand
      });
      if (movesNothing(zone, current)) {
        overlay?.hideInsertion();
      }
      else {
        overlay?.showInsertion(
          zone.line(current)
        );
      }
    }

    overlay?.moveGhost(
      clientX - ghostX,
      clientY - ghostY
    );
    result = {
      zone,
      index: current ?? 0,
      x: clientX,
      y: clientY
    };
    onPreview?.(result);
  }

  function teardown(): void {
    handle.removeEventListener(
      "pointermove",
      onPointerMove
    );
    handle.removeEventListener(
      "pointerup",
      onPointerUp
    );
    handle.removeEventListener(
      "pointercancel",
      onPointerCancel
    );
    document.removeEventListener(
      "keydown",
      onKeyDown,
      true
    );

    if (handle.hasPointerCapture(pointerId)) {
      handle.releasePointerCapture(pointerId);
    }

    overlay?.destroy();
    overlay = null;
    document.documentElement.classList.remove(kDraggingClass);
  }

  /**
   * Ends the session exactly once, whatever released it.
   *
   * A drag that never passed the threshold reports no placement, but still
   * settles: `onEnd` is the caller's only guarantee that the session is over.
   */
  function settle(
    commit: boolean
  ): void {
    if (settled) {
      return;
    }

    settled = true;
    const notify = started;
    teardown();
    if (notify) {
      if (commit) {
        onCommit(result);
      }
      else {
        onCancel?.();
      }
    }
    onEnd?.();
  }

  function onPointerMove(
    moveEvent: PointerEvent
  ): void {
    if (moveEvent.pointerId !== pointerId) {
      return;
    }

    if (!started) {
      const travelled = Math.hypot(
        moveEvent.clientX - originX,
        moveEvent.clientY - originY
      );
      if (travelled < threshold) {
        return;
      }

      begin();
    }

    update(moveEvent.clientX, moveEvent.clientY);
  }

  function onPointerUp(
    upEvent: PointerEvent
  ): void {
    if (upEvent.pointerId !== pointerId) {
      return;
    }

    settle(true);
  }

  function onPointerCancel(
    cancelEvent: PointerEvent
  ): void {
    if (cancelEvent.pointerId !== pointerId) {
      return;
    }

    settle(false);
  }

  function onKeyDown(
    keyEvent: KeyboardEvent
  ): void {
    if (keyEvent.key !== "Escape") {
      return;
    }

    keyEvent.preventDefault();
    keyEvent.stopPropagation();
    settle(false);
  }

  handle.setPointerCapture(pointerId);
  handle.addEventListener(
    "pointermove",
    onPointerMove
  );
  handle.addEventListener(
    "pointerup",
    onPointerUp
  );
  handle.addEventListener(
    "pointercancel",
    onPointerCancel
  );
  document.addEventListener(
    "keydown",
    onKeyDown,
    true
  );

  return {
    cancel(): void {
      settle(false);
    }
  };
}

/**
 * Builds the insertion line for a vertical stack of children.
 */
export function verticalInsertionLine(
  bounds: Rect,
  candidates: readonly DropCandidate[],
  index: number
): Rect {
  const position = index === 0 ?
    (candidates[0]?.start ?? bounds.y) :
    edgeOf(candidates[index - 1], bounds.y + bounds.height);

  return {
    x: bounds.x,
    y: position - (kInsertionThickness / 2),
    width: bounds.width,
    height: kInsertionThickness
  };
}

/**
 * Builds the insertion line for a horizontal stack of children.
 */
export function horizontalInsertionLine(
  bounds: Rect,
  candidates: readonly DropCandidate[],
  index: number
): Rect {
  const position = index === 0 ?
    (candidates[0]?.start ?? bounds.x) :
    edgeOf(candidates[index - 1], bounds.x + bounds.width);

  return {
    x: position - (kInsertionThickness / 2),
    y: bounds.y,
    width: kInsertionThickness,
    height: bounds.height
  };
}

function edgeOf(
  candidate: DropCandidate | undefined,
  fallback: number
): number {
  return candidate === undefined ?
    fallback :
    candidate.start + candidate.size;
}

function contains(
  rect: Rect,
  x: number,
  y: number
): boolean {
  return x >= rect.x &&
    x <= rect.x + rect.width &&
    y >= rect.y &&
    y <= rect.y + rect.height;
}

/**
 * Zone the dragged box has sunk furthest into, or `null` for none.
 *
 * Depth is measured across the zone, on the axis its children do not stack
 * along, so a window docks by moving toward the dock rather than by covering
 * its whole length. A zone thinner than the required depth arms on full
 * coverage instead, which is the case of an emptied dock reduced to a band.
 */
function entered(
  zones: readonly DragZone[],
  box: Rect | null
): DragZone | null {
  if (box === null) {
    return null;
  }

  let best: DragZone | null = null;
  let deepest = 0;
  for (const zone of zones) {
    const across = zone.axis === "y" ?
      overlap(box.x, box.width, zone.rect.x, zone.rect.width) :
      overlap(box.y, box.height, zone.rect.y, zone.rect.height);
    const along = zone.axis === "y" ?
      overlap(box.y, box.height, zone.rect.y, zone.rect.height) :
      overlap(box.x, box.width, zone.rect.x, zone.rect.width);
    const needed = Math.min(
      kEnterDepth,
      zone.axis === "y" ? zone.rect.width : zone.rect.height
    );
    if (along > 0 && across >= needed && across > deepest) {
      deepest = across;
      best = zone;
    }
  }

  return best;
}

/**
 * Overlap of two extents on one axis, in pixels.
 */
function overlap(
  start: number,
  size: number,
  otherStart: number,
  otherSize: number
): number {
  return Math.max(
    0,
    Math.min(start + size, otherStart + otherSize) - Math.max(start, otherStart)
  );
}

/**
 * True when inserting at `index` would leave the dragged element exactly where
 * it already sits, which is every index a lone child can resolve to.
 */
function movesNothing(
  zone: DragZone,
  index: number
): boolean {
  const source = zone.source ?? null;

  return source !== null &&
    (index === source || index === source + 1);
}

/**
 * Lazily installs the document-level cursor lock used during a drag.
 */
function ensureSessionStyles(): void {
  ensureDocumentStyles("jolly-drag-session-styles", `
    html.${kDraggingClass},
    html.${kDraggingClass} * {
      cursor: grabbing !important;
      user-select: none !important;
    }
  `);
}
