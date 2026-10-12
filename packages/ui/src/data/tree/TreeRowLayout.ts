// Import Internal Dependencies
import type { TreeIndentGuidesScope } from "./contract.ts";
import {
  isExpandable,
  isOpen,
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
    if (
      node === null ||
      isExpandable(node) ||
      !this.#snapshot.placement(id)?.levelHasBranches
    ) {
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

    const continues = this.#continuesFor(id);
    const last = continues.length - 1;
    const rails = continues.map((next, level): TreeRail => {
      if (level === last) {
        return next ? "tee" : "elbow";
      }

      return next ? "line" : "blank";
    });
    if (this.#startsLine(id)) {
      rails.push("start");
    }
    this.#rails.set(id, rails);

    return rails;
  }

  #selectedRails(
    id: string
  ): readonly TreeRail[] {
    const cached = this.#pathRails.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const rails: TreeRail[] = [];
    let childId = id;
    let parentId = this.#snapshot.parentId(childId);
    while (parentId !== undefined && parentId !== null) {
      rails.unshift(this.#pathRail(childId, parentId, childId === id));
      childId = parentId;
      parentId = this.#snapshot.parentId(childId);
    }
    if (this.#pathEnds.has(id) && this.#startsLine(id)) {
      rails.push("start");
    }
    const drawn = rails.every((rail) => rail === "blank") ? kNoRails : rails;
    this.#pathRails.set(id, drawn);

    return drawn;
  }

  #continuesFor(
    id: string
  ): readonly boolean[] {
    const cached = this.#continues.get(id);
    if (cached !== undefined) {
      return cached;
    }

    const parentId = this.#snapshot.parentId(id);
    const placement = this.#snapshot.placement(id);
    const continues = parentId === undefined || parentId === null || placement === undefined ?
      [] :
      [...this.#continuesFor(parentId), placement.position < placement.size];
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

  #startsLine(
    id: string
  ): boolean {
    const node = this.#snapshot.node(id);

    return node !== null &&
      node.children !== undefined &&
      node.children.length > 0 &&
      isOpen(node, this.#expanded);
  }
}
