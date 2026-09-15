// Import Internal Dependencies
import type { Dock } from "./Dock.ts";
import type { Floating } from "../floating/Floating.ts";
import { floatingOf } from "./LayoutProjection.ts";
import type {
  PaneDragDetail,
  PaneElement
} from "../pane/Pane.ts";
import { isPaneGroup } from "../pane-group/PaneGroup.ts";
import { headerGhost } from "../../interaction/drag/dragGhost.ts";
import {
  startDragSession,
  type DragSessionHandle
} from "../../interaction/drag/DragSession.ts";

export interface ExtractGrab {
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
}

export interface DockLayoutDragOptions {
  docks(): Dock[];
  dock(pane: PaneElement, dock: Dock, index: number): void;
  stack(pane: PaneElement, dock: Dock, slot: number, index: number): void;
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
      zones: () => this.#options.docks().map((dock) => {
        return {
          id: dock.layoutKey,
          rect: dock.dropZone(),
          candidates: dock.dropCandidates(),
          axis: dock.axis,
          source: dock === home ? dock.slots().indexOf(pane) : null,
          line: (index: number) => dock.insertionLine(index),
          stacks: dock.dropStacks(pane),
          preview: dock.previewZone()
        };
      }),
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
        const zoneId = result.zone?.id ?? null;
        const dock = zoneId === null ?
          null :
          this.#options.docks().find(
            (candidate) => candidate.layoutKey === zoneId
          ) ?? null;

        if (dock !== null && result.stack !== null) {
          this.#options.stack(
            pane,
            dock,
            result.stack.slot,
            result.stack.index
          );
        }
        else if (dock !== null) {
          this.#options.dock(pane, dock, result.index);
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
