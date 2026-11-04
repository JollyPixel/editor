// Import Internal Dependencies
import type { TreeIndentGuidesScope } from "./contract.ts";
import {
  isOpen,
  reservesToggle,
  type TreeSnapshot
} from "./model.ts";

export type TreeRail =
  | "line"
  | "blank"
  | "tee"
  | "elbow"
  | "start";

export type TreeRowSpacer = "none" | "inside" | "outside";

// CONSTANTS
const kNoRails: readonly TreeRail[] = Object.freeze([]);

export class TreeRowLayout<TData = unknown> {
  readonly #snapshot: TreeSnapshot<TData>;
  readonly #expanded: ReadonlySet<string>;
  readonly #continues = new Map<string, readonly boolean[]>();
  readonly #rails = new Map<string, readonly TreeRail[]>();
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
    const node = this.#snapshot.node(id);
    const levelHasBranches = this.#snapshot.placement(id)?.levelHasBranches;
    if (node === null || !reservesToggle(node, levelHasBranches === true)) {
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

    const continues = this.#railContinuations(id);
    const last = continues.length - 1;
    const rails = continues.map((next, level): TreeRail => {
      if (level === last) {
        return next ? "tee" : "elbow";
      }

      return next ? "line" : "blank";
    });
    const drawn = withStart(rails, this.#startColumn(id));
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
      (): TreeRail => "blank"
    );
    while (row !== null && row.parentId !== null) {
      const childId = row.node.id;
      rails[row.indent - 1] = this.#pathRail(
        childId,
        row.parentId,
        childId === id
      );
      row = this.#snapshot.row(row.parentId);
    }
    const started = withStart(
      rails,
      this.#pathEnds.has(id) ? this.#startColumn(id) : undefined
    );
    const drawn = started.every((rail) => rail === "blank") ?
      kNoRails :
      started;
    this.#pathRails.set(id, drawn);

    return drawn;
  }

  #railContinuations(
    id: string
  ): readonly boolean[] {
    const cached = this.#continues.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const row = this.#snapshot.row(id);
    const placement = this.#snapshot.placement(id);
    const continues = row === null ||
      row.parentId === null ||
      placement === undefined ?
      [] :
      [
        ...padEnd(this.#railContinuations(row.parentId), row.indent - 1, false),
        placement.position < placement.size
      ];
    this.#continues.set(id, continues);

    return continues;
  }

  #pathRail(
    childId: string,
    parentId: string,
    own: boolean
  ): TreeRail {
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

  #startColumn(
    id: string
  ): number | undefined {
    const node = this.#snapshot.node(id);
    const firstChild = node?.children?.[0];
    if (
      node === null ||
      firstChild === undefined ||
      !isOpen(node, this.#expanded)
    ) {
      return undefined;
    }

    const indent = this.#snapshot.row(firstChild.id)?.indent;

    return indent === undefined ? undefined : indent - 1;
  }
}

function withStart(
  rails: readonly TreeRail[],
  column: number | undefined
): readonly TreeRail[] {
  return column === undefined ?
    rails :
    [...padEnd(rails, column, "blank"), "start"];
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
