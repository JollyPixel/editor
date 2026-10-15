// Import Internal Dependencies
import type {
  DockDrop,
  DockSide
} from "./Dock.ts";
import { columnGroups } from "./dockColumns.ts";
import {
  joinLastGroup,
  movePane,
  panePlacement,
  stackPane,
  type DockAddress,
  type LayoutSnapshot
} from "./layout.ts";
import type { PaneMoveCommand } from "../pane/Pane.ts";

export type PaneStep = Exclude<PaneMoveCommand, "cancel" | "finish" | "start">;

export interface SteppableDock {
  layoutKey: string;
  side: DockSide;
  drop: DockDrop;
}

export class PaneStepper {
  readonly #docks: readonly SteppableDock[];

  constructor(
    docks: Iterable<SteppableDock>
  ) {
    this.#docks = [...docks];
  }

  step(
    snapshot: LayoutSnapshot,
    pane: string,
    step: PaneStep
  ): LayoutSnapshot {
    switch (step) {
      case "up":
      case "down":
        return this.#nudge(snapshot, pane, step === "up" ? -1 : 1);
      case "join-previous":
      case "join-next":
        return this.#join(snapshot, pane, step === "join-previous" ? -1 : 1);
      default:
        return this.#shift(snapshot, pane, step === "previous" ? -1 : 1);
    }
  }

  describe(
    snapshot: LayoutSnapshot,
    pane: string,
    label: string
  ): string {
    const placement = panePlacement(snapshot, pane);
    const dock = placement === null ?
      undefined :
      this.#docks.find((candidate) => candidate.layoutKey === placement.dock);
    if (placement === null || dock === undefined) {
      return `${label}, floating`;
    }

    const column = placement.column === "secondary" ? ", second column" : "";
    const position = `${label}, ${dock.side} dock${column}, position ` +
      `${placement.index + 1} of ${placement.count}`;
    if (placement.group.length === 1) {
      return position;
    }

    return `${position}, tab ` +
      `${placement.group.indexOf(pane) + 1} of ${placement.group.length}`;
  }

  #nudge(
    snapshot: LayoutSnapshot,
    pane: string,
    offset: number
  ): LayoutSnapshot {
    const placement = panePlacement(snapshot, pane);
    if (placement === null) {
      return snapshot;
    }

    if (placement.group.length > 1) {
      if (this.#drop(placement.dock) === "tabs") {
        return snapshot;
      }

      return movePane(
        snapshot,
        pane,
        placement,
        offset > 0 ? placement.index + 1 : placement.index
      );
    }

    const to = Math.min(
      Math.max(placement.index + offset, 0),
      placement.count - 1
    );
    if (placement.index === to) {
      return snapshot;
    }

    return movePane(
      snapshot,
      pane,
      placement,
      offset > 0 ? to + 1 : to
    );
  }

  #shift(
    snapshot: LayoutSnapshot,
    pane: string,
    offset: number
  ): LayoutSnapshot {
    const stops = this.#stops(snapshot, pane);
    if (stops.length === 0) {
      return snapshot;
    }

    const placement = panePlacement(snapshot, pane);
    const index = placement === null ?
      -1 :
      stops.findIndex((stop) => stop.dock === placement.dock &&
        stop.column === placement.column);
    const next = Math.min(
      Math.max(index === -1 ? offset * stops.length : index + offset, 0),
      stops.length - 1
    );
    if (index === next) {
      return snapshot;
    }

    const stop = stops[next];
    if (this.#drop(stop.dock) === "tabs") {
      return joinLastGroup(snapshot, pane, stop);
    }

    return movePane(
      snapshot,
      pane,
      stop,
      columnGroups(snapshot.docks[stop.dock], stop.column)?.length ?? 0
    );
  }

  #stops(
    snapshot: LayoutSnapshot,
    pane: string
  ): DockAddress[] {
    const placement = panePlacement(snapshot, pane);

    return this.#docks.flatMap((dock) => {
      const key = dock.layoutKey;
      const state = snapshot.docks[key];
      if (state === undefined || dock.drop === "none") {
        return [];
      }

      const primary: DockAddress = {
        dock: key,
        column: "primary"
      };
      const secondary: DockAddress = {
        dock: key,
        column: "secondary"
      };
      const alone = placement?.dock === key &&
        placement.column === "primary" &&
        state.groups.length === 1 &&
        placement.group.length === 1;
      if (
        state.secondary === undefined ||
        state.groups.length === 0 ||
        (state.secondary.length === 0 && alone)
      ) {
        return [primary];
      }

      return dock.side === "right" ?
        [secondary, primary] :
        [primary, secondary];
    });
  }

  #drop(
    dock: string
  ): DockDrop {
    return this.#docks.find(
      (candidate) => candidate.layoutKey === dock
    )?.drop ?? "any";
  }

  #join(
    snapshot: LayoutSnapshot,
    pane: string,
    offset: number
  ): LayoutSnapshot {
    const placement = panePlacement(snapshot, pane);
    if (placement === null) {
      return snapshot;
    }

    const slot = placement.index + offset;
    const target = columnGroups(
      snapshot.docks[placement.dock],
      placement.column
    )?.[slot];
    if (target === undefined) {
      return snapshot;
    }

    return stackPane(
      snapshot,
      pane,
      placement,
      slot,
      target.panes.length
    );
  }
}
