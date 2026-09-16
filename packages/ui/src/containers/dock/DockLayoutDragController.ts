// Import Internal Dependencies
import type { Dock } from "./Dock.ts";
import type { DockColumn } from "./layout.ts";
import { floatingOf } from "./LayoutProjection.ts";
import type { Floating } from "../floating/Floating.ts";
import type {
  PaneDragDetail,
  PaneElement
} from "../pane/Pane.ts";
import { isPaneGroup } from "../pane-group/PaneGroup.ts";
import { headerGhost } from "../../interaction/drag/dragGhost.ts";
import {
  startDragSession,
  type DragSessionHandle,
  type DragZone
} from "../../interaction/drag/DragSession.ts";

export interface ExtractGrab {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

export interface DockTarget {
  dock: Dock;
  column: DockColumn;
}

export interface DockLayoutDragOptions {
  docks(): Dock[];
  dock(pane: PaneElement, target: DockTarget, index: number): void;
  stack(
    pane: PaneElement,
    target: DockTarget,
    slot: number,
    index: number
  ): void;
  extract(pane: PaneElement, grab: ExtractGrab): void;
  place(pane: PaneElement, frame: Floating): void;
}

export class DockLayoutDragController {
  readonly #options: DockLayoutDragOptions;
  #session: DragSessionHandle | null = null;

  constructor(
    options: DockLayoutDragOptions
  ) {
    this.#options = options;
  }

  get active(): boolean {
    return this.#session !== null;
  }

  cancel(): void {
    this.#session?.cancel();
    this.#session = null;
  }

  start(
    detail: PaneDragDetail
  ): void {
    const { pane } = detail;
    const home = pane.closest("jolly-dock");
    const group = pane.parentElement !== null && isPaneGroup(pane.parentElement) ?
      pane.parentElement :
      null;
    const frame = floatingOf(pane);
    const originX = detail.event.clientX;
    const originY = detail.event.clientY;
    const rect = pane.getBoundingClientRect();
    const grabX = originX - rect.x;
    const grabY = originY - rect.y;
    const startX = frame?.x ?? 0;
    const startY = frame?.y ?? 0;
    const targets = new Map<string, DockTarget>();

    this.#session = startDragSession({
      source: pane,
      event: detail.event,
      handle: detail.handle,
      ghostLabel: pane.heading || pane.layoutKey,
      ghost: frame === null,
      ghostElement: () => {
        if (group !== null) {
          return null;
        }

        const ghost = headerGhost(pane);
        ghost.heading = pane.heading;
        ghost.icon = pane.icon;

        return ghost;
      },
      zones: () => {
        targets.clear();

        return this.#options.docks().flatMap((dock) => {
          const columns: DockColumn[] = dock.acceptsSecondary(pane) ?
            ["secondary", "primary"] :
            ["primary"];

          return columns.map((column): DragZone => {
            const id = `${dock.layoutKey}:${column}`;
            targets.set(id, {
              dock,
              column
            });

            return {
              id,
              rect: dock.dropZone(column),
              candidates: dock.dropCandidates(column),
              axis: dock.axis,
              source: dock === home ? dock.slots(column).indexOf(pane) : null,
              line: (index: number) => dock.insertionLine(index, column),
              stacks: dock.dropStacks(pane, column),
              preview: dock.previewZone(column)
            };
          });
        });
      },
      probe: frame === null ?
        undefined :
        (clientX: number, clientY: number) => {
          const box = frame.getBoundingClientRect();

          return {
            x: startX + clientX - originX,
            y: startY + clientY - originY,
            width: box.width,
            height: box.height
          };
        },
      onStart: () => {
        if (group !== null) {
          group.markDragging(pane.layoutKey);
        }
        else if (frame === null) {
          pane.dragging = true;
        }
        else {
          frame.dragging = true;
        }
      },
      onPreview: (result) => {
        frame?.moveTo(
          startX + result.x - originX,
          startY + result.y - originY
        );
      },
      onCommit: (result) => {
        const target = result.zone === null ?
          undefined :
          targets.get(result.zone.id);

        if (target !== undefined && result.stack !== null) {
          this.#options.stack(
            pane,
            target,
            result.stack.slot,
            result.stack.index
          );
        }
        else if (target !== undefined) {
          this.#options.dock(pane, target, result.index);
        }
        else if (frame === null) {
          this.#options.extract(pane, {
            x: result.x,
            y: result.y,
            offsetX: grabX,
            offsetY: grabY
          });
        }
        else {
          this.#options.place(pane, frame);
        }
      },
      onCancel: () => {
        frame?.moveTo(startX, startY);
      },
      onEnd: () => {
        this.#session = null;
        pane.dragging = false;
        group?.markDragging("");
        if (frame !== null) {
          frame.dragging = false;
        }
      }
    });
  }
}
