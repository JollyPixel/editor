// Import Internal Dependencies
import type { Dock } from "./Dock.ts";
import { Floating } from "./Floating.ts";
import type {
  DeclaredFloating,
  DeclaredLayout,
  FloatingState,
  LayoutSnapshot
} from "./layout.ts";
import type { PaneElement } from "./Pane.ts";

export interface LayoutProjectionHost extends HTMLElement {
  docks(): Dock[];
  panes(): PaneElement[];
}

export class LayoutProjection {
  readonly #host: LayoutProjectionHost;

  constructor(
    host: LayoutProjectionHost
  ) {
    this.#host = host;
  }

  readDeclared(): DeclaredLayout {
    const floating: DeclaredFloating[] = [];
    const locked: string[] = [];
    for (const pane of this.#host.panes()) {
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
      docks: this.#host.docks().map((dock) => {
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

  apply(
    snapshot: LayoutSnapshot
  ): void {
    const index = new Map(
      this.#host.panes().map((pane) => [pane.layoutKey, pane])
    );
    const released = new Set<Floating>();

    for (const dock of this.#host.docks()) {
      const state = snapshot.docks[dock.layoutKey];
      if (state === undefined) {
        continue;
      }

      if (state.size !== undefined) {
        dock.size = state.size;
      }
      dock.collapsed = state.collapsed === true;
      this.#orderPanes(dock, state.panes, index, released);
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
    for (const pane of index.values()) {
      this.applyFolders(pane, snapshot);
    }

    for (const frame of released) {
      if (frame.pane() === null) {
        frame.remove();
      }
    }
  }

  applyFolders(
    pane: PaneElement,
    snapshot: LayoutSnapshot
  ): void {
    pane.applyFolderStates(
      snapshot.folders[pane.layoutKey] ?? {}
    );
  }

  #orderPanes(
    dock: Dock,
    keys: readonly string[],
    index: ReadonlyMap<string, PaneElement>,
    released: Set<Floating>
  ): void {
    const current = dock.panes();
    let position = 0;
    for (const key of keys) {
      const pane = index.get(key);
      if (pane === undefined) {
        continue;
      }

      if (current[position] !== pane) {
        const frame = floatingOf(pane);
        if (frame !== null) {
          released.add(frame);
        }
        dock.insertBefore(pane, current[position] ?? null);
        const from = current.indexOf(pane);
        if (from !== -1) {
          current.splice(from, 1);
        }
        current.splice(position, 0, pane);
      }
      position++;
    }
  }

  #applyFloating(
    pane: PaneElement,
    geometry: FloatingState
  ): void {
    let frame = floatingOf(pane);
    if (frame === null) {
      frame = document.createElement("jolly-floating");
      this.#host.append(frame);
      frame.append(pane);
    }

    for (const key of ["x", "y", "width", "height"] as const) {
      const value = geometry[key];
      if (value !== undefined) {
        frame[key] = value;
      }
    }
  }
}

export function floatingOf(
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
