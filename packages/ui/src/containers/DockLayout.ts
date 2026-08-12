// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { Dock } from "./Dock.ts";
import { emitContainerEvent } from "./events.ts";
import { Floating } from "./Floating.ts";
import {
  emptyLayout,
  parseLayout,
  reconcileLayout,
  serializeLayout,
  type DeclaredFloating,
  type DeclaredLayout,
  type DockState,
  type FloatingState,
  type LayoutSnapshot,
  type PaneState
} from "./layout.ts";
import type {
  PaneElement,
  PaneMoveCommand
} from "./Pane.ts";
import { detailOf } from "../dom.ts";
import { headerGhost } from "../interaction/dragGhost.ts";
import {
  startDragSession,
  type DragSessionHandle
} from "../interaction/DragSession.ts";
import { LocalStorageAdapter } from "../storage/LocalStorageAdapter.ts";
import type { StorageAdapter } from "../storage/StorageAdapter.ts";

// CONSTANTS
const kExtractMinWidth = 160;
const kExtractMinHeight = 80;
/** Window kept under the cursor when a grab offset outruns its own box. */
const kGrabInset = 24;

/**
 * Where a pane was held when the drag that extracts it began.
 */
interface ExtractGrab {
  /** Pointer position at release. */
  x: number;
  y: number;
  /** Where inside the pane the pointer had hold of it. */
  offsetX: number;
  offsetY: number;
}

interface PaneDragDetail {
  pane: PaneElement;
  event: PointerEvent;
  handle: HTMLElement;
}

interface PaneMoveDetail {
  pane: PaneElement;
  command: PaneMoveCommand;
}

/**
 * Coordinates a set of docks, the panes inside them, and the floating windows
 * panes are dragged out into.
 *
 * The host contributes no geometry of its own: it renders `display: contents`
 * so the author keeps full control of the arrangement. What it owns is the
 * behaviour docks cannot own individually, namely which pane lives where, the
 * single persisted snapshot of that, and any drag that crosses a container.
 */
@customElement("jolly-dock-layout")
export class DockLayout extends LitElement {
  static override styles = css`
    :host {
      display: contents;
    }
  `;

  @property({ type: String, attribute: "storage-key" })
  declare storageKey: string;

  @property({ attribute: false })
  declare storage: StorageAdapter;

  #declared: DeclaredLayout | null = null;
  #snapshot: LayoutSnapshot = emptyLayout();
  /** Geometry each pane last floated at, kept while it is docked. */
  #geometry = new Map<string, FloatingState>();
  #session: DragSessionHandle | null = null;
  #applying = false;
  #saveQueued = false;
  #keyboardOrigin: LayoutSnapshot | null = null;

  constructor() {
    super();

    this.storageKey = "";
    this.storage = new LocalStorageAdapter();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener("jolly-pane-drag", this.#onPaneDrag);
    this.addEventListener("jolly-pane-move", this.#onPaneMove);
    this.addEventListener("jolly-layout-dirty", this.#onDirty);
  }

  override disconnectedCallback(): void {
    this.removeEventListener("jolly-pane-drag", this.#onPaneDrag);
    this.removeEventListener("jolly-pane-move", this.#onPaneMove);
    this.removeEventListener("jolly-layout-dirty", this.#onDirty);
    this.#session?.cancel();
    this.#session = null;
    super.disconnectedCallback();
  }

  override render(): TemplateResult {
    return html`<slot @slotchange=${this.#onSlotChange}></slot>`;
  }

  protected override firstUpdated(): void {
    this.#declared = this.#readDeclared();
    this.#snapshot = reconcileLayout(
      parseLayout(this.storage.get(this.#namespace())),
      this.#declared
    );
    this.#apply(this.#snapshot);
  }

  /**
   * Docks registered under this layout, in document order.
   */
  docks(): Dock[] {
    return [...this.querySelectorAll("jolly-dock")].filter(
      (dock) => dock.closest("jolly-dock-layout") === this
    );
  }

  /**
   * Panes registered under this layout, docked or floating.
   */
  panes(): PaneElement[] {
    return [...this.querySelectorAll("jolly-pane")].filter(
      (pane) => pane.closest("jolly-dock-layout") === this
    );
  }

  /**
   * Re-reads the markup and re-applies the current snapshot onto it.
   */
  sync(): void {
    if (this.#applying) {
      return;
    }

    this.#snapshot = reconcileLayout(
      this.#snapshot,
      this.#readDeclared()
    );
    this.#apply(this.#snapshot);
  }

  /**
   * Discards the stored arrangement and restores the authored one.
   */
  resetLayout(): void {
    this.storage.set(this.#namespace(), "");
    this.#snapshot = reconcileLayout(
      null,
      this.#declared ?? this.#readDeclared()
    );
    this.#apply(this.#snapshot);
    emitContainerEvent(this, "jolly-layout-change", {
      snapshot: this.#snapshot
    });
  }

  /**
   * Current arrangement, as it would be persisted.
   */
  snapshot(): LayoutSnapshot {
    return this.#read();
  }

  #onSlotChange = () => {
    if (this.#applying || !this.hasUpdated) {
      return;
    }

    this.sync();
  };

  #onDirty = () => {
    if (this.#applying || this.#saveQueued) {
      return;
    }

    this.#saveQueued = true;
    queueMicrotask(() => {
      this.#saveQueued = false;
      this.#save();
    });
  };

  /**
   * Runs a pane drag that may end in any dock, in a new floating window, or
   * simply somewhere else on screen.
   */
  #onPaneDrag = (
    event: Event
  ) => {
    const detail = detailOf<PaneDragDetail>(event);
    if (detail === null || this.#session !== null) {
      return;
    }

    event.stopPropagation();
    const { pane } = detail;
    const home = pane.closest("jolly-dock");
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
      ghostLabel: pane.title || pane.layoutKey,
      ghost: frame === null,
      ghostElement: () => {
        const ghost = headerGhost(pane);
        // Only "title" needs putting back: it is the one thing the header
        // shows that a clone of the attributes alone does not carry.
        ghost.title = pane.title;

        return ghost;
      },
      // Every dock takes the pane across its whole surface, its own dock
      // included: one gesture moves a pane from any dock to any other, with no
      // detour through a floating window.
      zones: () => this.docks().map((dock) => {
        return {
          id: dock.layoutKey,
          rect: dock.dropZone(),
          candidates: dock.dropCandidates(),
          axis: dock.axis,
          source: dock === home ? dock.panes().indexOf(pane) : null,
          line: (index: number) => dock.insertionLine(index)
        };
      }),
      // A window is dragged by its whole box, so a dock it has entered arms
      // even when the cursor is still short of it. Without a window there is
      // nothing but the cursor to go by.
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
        // Exactly one source ghosts: a docked pane dims in the slot it keeps,
        // and a floating one hands that over to the window carrying it.
        if (frame === null) {
          pane.dragging = true;
        }
        else {
          frame.dragging = true;
        }
      },
      onPreview: (result) => {
        // The window keeps following the pointer even over an armed dock: it
        // is dimmed, so the insertion line stays readable underneath it, and
        // a window that stopped dead would read as a dropped gesture.
        frame?.moveTo(
          startX + result.x - originX,
          startY + result.y - originY
        );
      },
      onCommit: (result) => {
        const zoneId = result.zone?.id ?? null;
        const dock = zoneId === null ?
          null :
          this.docks().find(
            (candidate) => candidate.layoutKey === zoneId
          ) ?? null;

        if (dock !== null) {
          this.#dockPane(pane, dock, result.index);
        }
        else if (frame === null) {
          this.#extract(pane, {
            x: result.x,
            y: result.y,
            offsetX: grabX,
            offsetY: grabY
          });
        }

        this.#save();
      },
      onCancel: () => {
        if (frame !== null) {
          frame.moveTo(startX, startY);
        }
      },
      onEnd: () => {
        this.#session = null;
        pane.dragging = false;
        if (frame !== null) {
          frame.dragging = false;
        }
      }
    });
  };

  #onPaneMove = (
    event: Event
  ) => {
    const detail = detailOf<PaneMoveDetail>(event);
    if (detail === null) {
      return;
    }

    event.stopPropagation();
    const { pane, command } = detail;
    const label = pane.title || pane.layoutKey;

    if (command === "start") {
      this.#keyboardOrigin = this.#read();
      pane.announce(`${label} grabbed`);

      return;
    }
    if (command === "cancel") {
      if (this.#keyboardOrigin !== null) {
        this.#apply(this.#keyboardOrigin);
      }
      this.#keyboardOrigin = null;
      pane.announce(`${label} movement cancelled`);

      return;
    }
    if (command === "finish") {
      this.#keyboardOrigin = null;
      this.#save();
      pane.announce(`${label} dropped`);

      return;
    }

    if (command === "up" || command === "down") {
      this.#nudge(pane, command === "up" ? -1 : 1);
    }
    else {
      this.#shift(pane, command === "previous" ? -1 : 1);
    }

    pane.announce(this.#positionOf(pane, label));
  };

  /**
   * Moves a pane one slot along the dock it already sits in.
   */
  #nudge(
    pane: PaneElement,
    offset: number
  ): void {
    const dock = pane.closest("jolly-dock");
    if (dock === null) {
      return;
    }

    const list = dock.panes();
    const from = list.indexOf(pane);
    const to = Math.min(
      Math.max(from + offset, 0),
      list.length - 1
    );
    if (from === -1 || from === to) {
      return;
    }

    this.#dockPane(pane, dock, offset > 0 ? to + 1 : to);
  }

  /**
   * Moves a pane to the adjacent dock, docking a floating pane on the way in.
   */
  #shift(
    pane: PaneElement,
    offset: number
  ): void {
    const docks = this.docks();
    if (docks.length === 0) {
      return;
    }

    const home = pane.closest("jolly-dock");
    if (home === null) {
      const target = offset < 0 ? docks[0] : docks[docks.length - 1];
      this.#dockPane(pane, target, target.panes().length);

      return;
    }

    const index = docks.indexOf(home);
    const next = Math.min(
      Math.max(index + offset, 0),
      docks.length - 1
    );
    if (index === next) {
      return;
    }

    this.#dockPane(pane, docks[next], docks[next].panes().length);
  }

  /**
   * Places a pane in a dock at an insertion index.
   *
   * The index counts the dock's current children, including the pane itself
   * when it already lives there, which is what a drag session reports.
   */
  #dockPane(
    pane: PaneElement,
    dock: Dock,
    index: number
  ): void {
    const list = dock.panes();
    const from = list.indexOf(pane);
    const target = from !== -1 && index > from ? index - 1 : index;
    const others = list.filter((candidate) => candidate !== pane);
    const reference = others[target] ?? null;

    // Reinserting a pane before the sibling it already precedes would
    // reparent it for nothing, tearing down and rebuilding its subtree.
    if (from !== -1 && reference === (list[from + 1] ?? null)) {
      return;
    }

    const frame = this.#releaseWindow(pane);
    dock.insertBefore(pane, reference);
    this.#discardWindow(frame);
    this.#refresh();
  }

  /**
   * Detaches a pane into a new floating window under the pointer.
   *
   * The window comes back at the size the pane last floated at, not at the one
   * its dock stretched it to: a window narrowed to fit a corner of the screen
   * that returned dock-sized would have to be narrowed again every time.
   * Nothing remembered means nothing to restore, so a pane leaving a dock for
   * the first time is sized by what it measures there.
   */
  #extract(
    pane: PaneElement,
    grab: ExtractGrab
  ): void {
    const rect = pane.getBoundingClientRect();
    const remembered = this.#geometry.get(pane.layoutKey);
    const width = Math.max(
      remembered?.width ?? rect.width,
      kExtractMinWidth
    );
    const height = Math.max(
      remembered?.height ?? rect.height,
      kExtractMinHeight
    );

    const frame = document.createElement("jolly-floating");
    // A window narrower than the pane was in its dock would otherwise be hung
    // off a grab offset past its own edge, and land away from the cursor.
    frame.x = grab.x - Math.min(grab.offsetX, Math.max(width - kGrabInset, 0));
    frame.y = grab.y - Math.min(grab.offsetY, Math.max(height - kGrabInset, 0));
    frame.width = width;
    frame.height = height;
    this.append(frame);
    frame.append(pane);
    this.#refresh();
    void frame.updateComplete.then(() => {
      frame.clampToView();
      frame.raise();
    });
  }

  /**
   * Takes a pane out of its window, keeping the geometry it had in it.
   *
   * The window is discarded moments later and is the only thing that knows how
   * big the pane was, so what it knows has to outlive it.
   */
  #releaseWindow(
    pane: PaneElement
  ): Floating | null {
    const frame = floatingOf(pane);
    if (frame !== null) {
      this.#geometry.set(pane.layoutKey, geometryOf(frame));
    }

    return frame;
  }

  #discardWindow(
    frame: Floating | null
  ): void {
    if (frame !== null && frame.pane() === null) {
      frame.remove();
    }
  }

  #positionOf(
    pane: PaneElement,
    label: string
  ): string {
    const dock = pane.closest("jolly-dock");
    if (dock === null) {
      return `${label}, floating`;
    }

    const list = dock.panes();

    return `${label}, ${dock.side} dock, position ` +
      `${list.indexOf(pane) + 1} of ${list.length}`;
  }

  /**
   * Applies a snapshot onto the DOM: placement first, then geometry.
   */
  #apply(
    snapshot: LayoutSnapshot
  ): void {
    this.#applying = true;
    try {
      const index = new Map(
        this.panes().map((pane) => [pane.layoutKey, pane])
      );
      // Replaced rather than merged, so a reset forgets the sizes panes were
      // given since instead of handing them back on the next drag out.
      this.#geometry = new Map(
        Object.entries(snapshot.geometry)
      );

      for (const dock of this.docks()) {
        const state = snapshot.docks[dock.layoutKey];
        if (state === undefined) {
          continue;
        }

        if (state.size !== undefined) {
          dock.size = state.size;
        }
        dock.collapsed = state.collapsed === true;
        this.#orderPanes(dock, state.panes, index);
      }

      for (const [key, geometry] of Object.entries(snapshot.floating)) {
        const pane = index.get(key);
        if (pane !== undefined) {
          this.#applyFloating(pane, geometry);
        }
      }

      for (const [key, state] of Object.entries(snapshot.panes)) {
        const pane = index.get(key);
        if (pane !== undefined && state.collapsed !== undefined) {
          pane.collapsed = state.collapsed;
        }
      }
    }
    finally {
      this.#applying = false;
    }
  }

  #orderPanes(
    dock: Dock,
    keys: readonly string[],
    index: ReadonlyMap<string, PaneElement>
  ): void {
    const desired: PaneElement[] = [];
    for (const key of keys) {
      const pane = index.get(key);
      if (pane !== undefined) {
        desired.push(pane);
      }
    }

    const current = dock.panes();
    const unchanged = desired.length === current.length &&
      desired.every((pane, position) => pane === current[position]);
    if (unchanged) {
      return;
    }

    for (const pane of desired) {
      const frame = this.#releaseWindow(pane);
      dock.append(pane);
      this.#discardWindow(frame);
    }
  }

  #applyFloating(
    pane: PaneElement,
    geometry: FloatingState
  ): void {
    let frame = floatingOf(pane);
    if (frame === null) {
      frame = document.createElement("jolly-floating");
      this.append(frame);
      frame.append(pane);
    }

    for (const key of ["x", "y", "width", "height"] as const) {
      const value = geometry[key];
      if (value !== undefined) {
        frame[key] = value;
      }
    }
  }

  /**
   * Reads the arrangement the markup currently describes, geometry included.
   *
   * Captured once before the stored snapshot is applied, so `resetLayout` has
   * the authored sizes and window positions to restore, not merely the
   * authored placement.
   */
  #readDeclared(): DeclaredLayout {
    const floating: DeclaredFloating[] = [];
    const locked: string[] = [];
    for (const pane of this.panes()) {
      const frame = floatingOf(pane);
      if (frame !== null) {
        floating.push({
          key: pane.layoutKey,
          geometry: geometryOf(frame)
        });
      }
      if (pane.locked) {
        locked.push(pane.layoutKey);
      }
    }

    return {
      docks: this.docks().map((dock) => {
        return {
          key: dock.layoutKey,
          size: dock.size,
          panes: dock.panes().map((pane) => pane.layoutKey)
        };
      }),
      floating,
      locked
    };
  }

  /**
   * Reads the arrangement the DOM currently has.
   *
   * A window on screen is the freshest word on the size of the pane in it, so
   * reading one also updates what that pane is remembered at.
   */
  #read(): LayoutSnapshot {
    const docks: Record<string, DockState> = {};
    for (const dock of this.docks()) {
      docks[dock.layoutKey] = {
        size: dock.size,
        collapsed: dock.collapsed,
        panes: dock.panes().map((pane) => pane.layoutKey)
      };
    }

    const floating: Record<string, FloatingState> = {};
    const geometry: Record<string, FloatingState> = {};
    const panes: Record<string, PaneState> = {};
    for (const pane of this.panes()) {
      const frame = floatingOf(pane);
      if (frame !== null) {
        floating[pane.layoutKey] = geometryOf(frame);
        this.#geometry.set(pane.layoutKey, geometryOf(frame));
      }

      // Copied on the way out: the snapshot is handed to callers, and what
      // they get must not reach back into the cache behind it.
      const remembered = this.#geometry.get(pane.layoutKey);
      if (remembered !== undefined) {
        geometry[pane.layoutKey] = { ...remembered };
      }
      if (pane.collapsible) {
        panes[pane.layoutKey] = {
          collapsed: pane.collapsed
        };
      }
    }

    return {
      ...emptyLayout(),
      docks,
      floating,
      geometry,
      panes
    };
  }

  /**
   * Re-reads the snapshot from the DOM without persisting it.
   *
   * Every placement change has to land here at once. Adding or removing a
   * floating window re-runs the host slot change, and the `sync()` that
   * follows reconciles stored placement over declared placement: against a
   * snapshot that still describes the old arrangement, it would undo the move
   * that had just been made.
   */
  #refresh(): void {
    this.#snapshot = this.#read();
  }

  #save(): void {
    this.#refresh();
    this.storage.set(
      this.#namespace(),
      serializeLayout(this.#snapshot)
    );
    emitContainerEvent(this, "jolly-layout-change", {
      snapshot: this.#snapshot
    });
  }

  #namespace(): string {
    if (this.storageKey !== "") {
      return this.storageKey;
    }

    const path = globalThis.location?.pathname ?? "";

    return `${path}:jolly-dock-layout`;
  }
}

function floatingOf(
  pane: PaneElement
): Floating | null {
  const parent = pane.parentElement;

  return parent instanceof Floating ? parent : null;
}

function geometryOf(
  frame: Floating
): FloatingState {
  return {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-dock-layout": DockLayout;
  }
}
