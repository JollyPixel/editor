// Import Internal Dependencies
import type {
  Dock,
  DockSlot
} from "./Dock.ts";
import { Floating } from "../floating/Floating.ts";
import type {
  DeclaredFloating,
  DeclaredGroup,
  DeclaredLayout,
  FloatingState,
  LayoutSnapshot,
  PaneGroupState
} from "./layout.ts";
import {
  isPane,
  type PaneElement
} from "../pane/Pane.ts";
import {
  isPaneGroup,
  PaneGroup
} from "../pane-group/PaneGroup.ts";

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
        if (!dock.splittable) {
          return {
            key: dock.layoutKey,
            size: dock.size,
            groups: declaredGroups(dock.slots())
          };
        }

        return {
          key: dock.layoutKey,
          size: dock.size,
          groups: declaredGroups(dock.slots("primary")),
          double: true,
          secondary: declaredGroups(dock.slots("secondary"))
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
    const claimed = new Set<PaneGroup>();

    for (const dock of this.#host.docks()) {
      const state = snapshot.docks[dock.layoutKey];
      if (state === undefined) {
        continue;
      }

      if (state.size !== undefined) {
        dock.size = state.size;
      }
      dock.collapsed = state.collapsed === true;
      const primary = state.groups
        .map((group) => this.#slotFor(group, index, released, claimed))
        .filter((slot) => slot !== null);
      const secondary = (state.secondary ?? [])
        .map((group) => this.#slotFor(group, index, released, claimed))
        .filter((slot) => slot !== null);
      for (const slot of primary) {
        slot.removeAttribute("slot");
      }
      for (const slot of secondary) {
        slot.setAttribute("slot", "secondary");
      }
      orderChildren(dock, dockChildren(dock), [...primary, ...secondary]);
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
    this.#discardGroups();
  }

  applyFolders(
    pane: PaneElement,
    snapshot: LayoutSnapshot
  ): void {
    pane.applyFolderStates(
      snapshot.folders[pane.layoutKey] ?? {}
    );
  }

  #slotFor(
    state: PaneGroupState,
    index: ReadonlyMap<string, PaneElement>,
    released: Set<Floating>,
    claimed: Set<PaneGroup>
  ): DockSlot | null {
    const panes = state.panes
      .map((key) => index.get(key))
      .filter((pane) => pane !== undefined);
    for (const pane of panes) {
      const frame = floatingOf(pane);
      if (frame !== null) {
        released.add(frame);
      }
    }
    if (panes.length === 0) {
      return null;
    }
    if (panes.length === 1) {
      return panes[0];
    }

    let group = panes
      .map((pane) => pane.parentElement)
      .find((parent): parent is PaneGroup => parent instanceof PaneGroup &&
        !claimed.has(parent)) ?? null;
    if (group === null) {
      group = document.createElement("jolly-pane-group");
    }
    for (const pane of panes) {
      pane.removeAttribute("slot");
    }
    claimed.add(group);
    group.active = state.active;
    orderChildren(group, group.panes(), panes);

    return group;
  }

  #discardGroups(): void {
    for (const group of this.#host.querySelectorAll("jolly-pane-group")) {
      if (group.closest("jolly-dock-layout") !== this.#host) {
        continue;
      }

      const panes = [...group.children].filter(
        (child) => child.tagName === "JOLLY-PANE"
      );
      if (panes.length === 1) {
        const slot = group.getAttribute("slot");
        if (slot === null) {
          panes[0].removeAttribute("slot");
        }
        else {
          panes[0].setAttribute("slot", slot);
        }
        group.before(panes[0]);
      }
      if (panes.length <= 1) {
        group.remove();
      }
    }
  }

  #applyFloating(
    pane: PaneElement,
    geometry: FloatingState
  ): void {
    let frame = floatingOf(pane);
    pane.removeAttribute("slot");
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

function declaredGroups(
  slots: readonly DockSlot[]
): DeclaredGroup[] {
  return slots.map((slot) => {
    if (!isPaneGroup(slot)) {
      return {
        panes: [slot.layoutKey]
      };
    }

    return {
      panes: slot.panes().map((pane) => pane.layoutKey),
      ...slot.active === "" ? {} : { active: slot.active }
    };
  });
}

function dockChildren(
  dock: Dock
): DockSlot[] {
  return [...dock.children].filter(
    (element): element is DockSlot => isPane(element) || isPaneGroup(element)
  );
}

function orderChildren(
  parent: HTMLElement,
  current: Element[],
  wanted: readonly Element[]
): void {
  let position = 0;
  for (const element of wanted) {
    if (current[position] !== element) {
      parent.insertBefore(element, current[position] ?? null);
      const from = current.indexOf(element);
      if (from !== -1) {
        current.splice(from, 1);
      }
      current.splice(position, 0, element);
    }
    position++;
  }
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
