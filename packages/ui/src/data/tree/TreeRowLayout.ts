// Import Internal Dependencies
import type { TreeIndentGuidesScope } from "./contract.ts";
import {
  isExpandable,
  isOpen,
  type FlatTreeRow,
  type TreeSnapshot
} from "./model.ts";

export type TreeRailStroke =
  | "line"
  | "blank"
  | "tee"
  | "elbow"
  | "start";

export type TreeRailAnchor =
  | "toggle"
  | "icon"
  | "icon-after-spacer"
  | "icon-after-step";

export interface TreeRail {
  readonly stroke: TreeRailStroke;
  readonly anchor: TreeRailAnchor;
}

export type TreeRowSpacer = "none" | "inside" | "outside";

interface TreeLineStart {
  column: number;
  anchor: TreeRailAnchor;
}

// CONSTANTS
const kNoRails: readonly TreeRail[] = Object.freeze([]);
const kBlank: TreeRail = Object.freeze({
  stroke: "blank",
  anchor: "toggle"
});

export class TreeRowLayout<TData = unknown> {
  readonly #snapshot: TreeSnapshot<TData>;
  readonly #expanded: ReadonlySet<string>;
  readonly #throughRails = new Map<string, readonly TreeRail[]>();
  readonly #rails = new Map<string, readonly TreeRail[]>();
  readonly #anchors = new Map<string, TreeRailAnchor>();
  readonly #pathEnds = new Map<string, number>();
  readonly #pathIds = new Set<string>();
  readonly #pathRails = new Map<string, readonly TreeRail[]>();

  constructor(
    snapshot: TreeSnapshot<TData>,
    expanded: ReadonlySet<string>
  ) {
    this.#snapshot = snapshot;
    this.#expanded = expanded;
  }

  rails(
    id: string,
    scope: TreeIndentGuidesScope = "all"
  ): readonly TreeRail[] {
    return scope === "all" ? this.#allRails(id) : this.#selectedRails(id);
  }

  spacer(
    id: string,
    guides: boolean
  ): TreeRowSpacer {
    if (!this.#snapshot.reservesToggle(id)) {
      return "none";
    }

    return guides ? "outside" : "inside";
  }

  follow(
    selected: Iterable<string>
  ): void {
    this.#pathEnds.clear();
    this.#pathIds.clear();
    this.#pathRails.clear();
    for (const id of selected) {
      let childId = id;
      let parentId = this.#snapshot.parentId(childId);
      while (parentId !== undefined && parentId !== null) {
        const position = this.#snapshot.placement(childId)?.position ?? 0;
        this.#pathIds.add(childId);
        this.#pathEnds.set(
          parentId,
          Math.max(this.#pathEnds.get(parentId) ?? 0, position)
        );
        childId = parentId;
        parentId = this.#snapshot.parentId(childId);
      }
    }
  }

  #allRails(
    id: string
  ): readonly TreeRail[] {
    const cached = this.#rails.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const through = this.#railsThrough(id);
    const last = through.length - 1;
    const rails = through.map(
      (rail, level) => (level === last ? endRail(rail) : rail)
    );
    const drawn = withStart(rails, this.#lineStart(id));
    this.#rails.set(id, drawn);

    return drawn;
  }

  #selectedRails(
    id: string
  ): readonly TreeRail[] {
    const cached = this.#pathRails.get(id);
    if (cached !== undefined) {
      return cached;
    }

    let row = this.#snapshot.row(id);
    const rails = Array.from(
      { length: row?.indent ?? 0 },
      () => kBlank
    );
    while (row !== null && row.parentId !== null) {
      const childId = row.node.id;
      rails[row.indent - 1] = {
        stroke: this.#pathRail(childId, row.parentId, childId === id),
        anchor: this.#anchor(row.parentId, row)
      };
      row = this.#snapshot.row(row.parentId);
    }
    const started = withStart(
      rails,
      this.#pathEnds.has(id) ? this.#lineStart(id) : undefined
    );
    const drawn = started.every((rail) => rail.stroke === "blank") ?
      kNoRails :
      started;
    this.#pathRails.set(id, drawn);

    return drawn;
  }

  #railsThrough(
    id: string
  ): readonly TreeRail[] {
    const cached = this.#throughRails.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const row = this.#snapshot.row(id);
    const placement = this.#snapshot.placement(id);
    const through: readonly TreeRail[] = row === null ||
      row.parentId === null ||
      placement === undefined ?
      kNoRails :
      [
        ...padEnd(this.#railsThrough(row.parentId), row.indent - 1, kBlank),
        {
          stroke: placement.position < placement.size ? "line" : "blank",
          anchor: this.#anchor(row.parentId, row)
        }
      ];
    this.#throughRails.set(id, through);

    return through;
  }

  #pathRail(
    childId: string,
    parentId: string,
    own: boolean
  ): TreeRailStroke {
    const end = this.#pathEnds.get(parentId);
    const position = this.#snapshot.placement(childId)?.position ?? 0;
    if (end === undefined || position > end) {
      return "blank";
    }
    if (!own) {
      return position < end ? "line" : "blank";
    }
    if (this.#pathIds.has(childId)) {
      return position < end ? "tee" : "elbow";
    }

    return "line";
  }

  #lineStart(
    id: string
  ): TreeLineStart | undefined {
    const node = this.#snapshot.node(id);
    const firstChildId = node?.children?.[0]?.id;
    if (
      node === null ||
      firstChildId === undefined ||
      !isOpen(node, this.#expanded)
    ) {
      return undefined;
    }

    const child = this.#snapshot.row(firstChildId);

    return child === null ?
      undefined :
      {
        column: child.indent - 1,
        anchor: this.#anchor(id, child)
      };
  }

  #anchor(
    parentId: string,
    child: FlatTreeRow<TData>
  ): TreeRailAnchor {
    let anchor = this.#anchors.get(parentId);
    if (anchor === undefined) {
      anchor = this.#anchorBelow(parentId, child);
      this.#anchors.set(parentId, anchor);
    }

    return anchor;
  }

  #anchorBelow(
    parentId: string,
    child: FlatTreeRow<TData>
  ): TreeRailAnchor {
    const parent = this.#snapshot.row(parentId);
    if (parent === null || isExpandable(parent.node)) {
      return "toggle";
    }
    if (!this.#snapshot.reservesToggle(parentId)) {
      return "icon";
    }
    if (child.indent > parent.indent + 1) {
      return "icon-after-step";
    }
    const childrenHaveToggles =
      this.#snapshot.placement(child.node.id)?.levelHasBranches === true;

    return childrenHaveToggles ? "toggle" : "icon-after-spacer";
  }
}

function endRail(
  rail: TreeRail
): TreeRail {
  return {
    stroke: rail.stroke === "line" ? "tee" : "elbow",
    anchor: rail.anchor
  };
}

function withStart(
  rails: readonly TreeRail[],
  start: TreeLineStart | undefined
): readonly TreeRail[] {
  return start === undefined ?
    rails :
    [
      ...padEnd(rails, start.column, kBlank),
      {
        stroke: "start",
        anchor: start.anchor
      }
    ];
}

function padEnd<T>(
  values: readonly T[],
  length: number,
  filler: T
): T[] {
  return [
    ...values,
    ...Array.from({ length: length - values.length }, () => filler)
  ];
}
