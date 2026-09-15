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
import { kFallback } from "../../theme/styles/fallbacks.ts";
import { resolveThemeToken } from "../../theme/resolveThemeToken.ts";
import {
  startPointerDragSession
} from "../pointer/PointerDragSession.ts";

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
  stacks?: DragStack[];
  preview?: Rect;
}

export interface DragStack {
  slot: number;
  rect: Rect;
  candidates: DropCandidate[];
  source?: number | null;
  line(
    index: number
  ): Rect;
}

export interface DragStackResult {
  slot: number;
  index: number;
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
  stack: DragStackResult | null;
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
  onCancel?(): void;
  onEnd?(): void;
}

export interface DragSessionHandle {
  cancel(): void;
}

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

  const originX = event.clientX;
  const originY = event.clientY;

  let overlay: DragOverlay | null = null;
  let armed: DragZone[] = [];
  let current: number | null = null;
  let ghostX = -kChipOffset;
  let ghostY = -kChipOffset;
  let result: DragResult = {
    zone: null,
    index: 0,
    stack: null,
    x: originX,
    y: originY
  };

  function begin(): void {
    armed = zones();
    if (visuals) {
      const rect = source.getBoundingClientRect();
      const element = ghost ? ghostElement?.() ?? null : null;
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
      zone === null ? null : armed.indexOf(zone),
      zone?.preview
    );
    const stack = zone?.stacks?.find(
      (candidate) => contains(candidate.rect, clientX, clientY)
    ) ?? null;
    let stacked: DragStackResult | null = null;
    if (zone === null) {
      current = null;
      overlay?.hideInsertion();
    }
    else if (stack === null) {
      const sameZone = result.zone !== null && result.zone.id === zone.id;
      current = resolveDropIndex({
        position: zone.axis === "y" ? clientY : clientX,
        candidates: zone.candidates,
        current: sameZone ? current : null,
        deadBand
      });
      if (movesNothing(zone.source, current)) {
        overlay?.hideInsertion();
      }
      else {
        overlay?.showInsertion(
          zone.line(current)
        );
      }
    }
    else {
      const sameStack = result.stack !== null &&
        result.zone?.id === zone.id &&
        result.stack.slot === stack.slot;
      const index = resolveDropIndex({
        position: clientX,
        candidates: stack.candidates,
        current: sameStack ? result.stack?.index ?? null : null,
        deadBand
      });
      stacked = {
        slot: stack.slot,
        index
      };
      if (movesNothing(stack.source, index)) {
        overlay?.hideInsertion();
      }
      else {
        overlay?.showInsertion(stack.line(index));
      }
    }

    overlay?.moveGhost(
      clientX - ghostX,
      clientY - ghostY
    );
    result = {
      zone,
      index: current ?? 0,
      stack: stacked,
      x: clientX,
      y: clientY
    };
    onPreview?.(result);
  }

  function teardown(): void {
    overlay?.destroy();
    overlay = null;
  }

  const pointerSession = startPointerDragSession({
    element: handle,
    event,
    threshold,
    documentClass: kDraggingClass,
    onStart: begin,
    onMove: update,
    onFinish: (settlement, started) => {
      teardown();
      if (started) {
        if (settlement === "commit") {
          onCommit(result);
        }
        else {
          onCancel?.();
        }
      }
      onEnd?.();
    }
  });

  return {
    cancel(): void {
      pointerSession.cancel();
    }
  };
}

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

function movesNothing(
  source: number | null | undefined,
  index: number
): boolean {
  return source !== undefined &&
    source !== null &&
    (index === source || index === source + 1);
}

function ensureSessionStyles(): void {
  ensureDocumentStyles("jolly-drag-session-styles", `
    html.${kDraggingClass},
    html.${kDraggingClass} * {
      cursor: grabbing !important;
      user-select: none !important;
    }
  `);
}
