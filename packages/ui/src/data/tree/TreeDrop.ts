// Import Internal Dependencies
import type {
  TreeDropAccept,
  TreeDropWhere
} from "./contract.ts";
import type { TreePointerDropPreview } from "./interaction.ts";
import type {
  FlatTreeRow,
  TreeSnapshot
} from "./model.ts";

export interface TreeDropOptions<TData> {
  snapshot: TreeSnapshot<TData>;
  movedIds: string[];
  accept?: TreeDropAccept | null;
  rows?: readonly FlatTreeRow<TData>[];
}

export interface TreeDropRow {
  id: string;
  top: number;
  height: number;
}

export interface TreeDropPointer {
  clientX: number;
  clientY: number;
  row: TreeDropRow | null;
  container?: {
    top: number;
    left: number;
  };
  indentUnit: number;
}

interface EdgeRows<TData> {
  first: FlatTreeRow<TData> | undefined;
  last: FlatTreeRow<TData> | undefined;
}

export class TreeDrop<TData = unknown> {
  readonly #snapshot: TreeSnapshot<TData>;
  readonly #movedIds: string[];
  readonly #accept: TreeDropAccept | null;
  readonly #rows: readonly FlatTreeRow<TData>[];
  #edgeRows: EdgeRows<TData> | null = null;

  static zone(
    row: Pick<TreeDropRow, "top" | "height">,
    clientY: number
  ): TreeDropWhere {
    const offsetY = clientY - row.top;
    if (offsetY < row.height / 4) {
      return "above";
    }
    if (offsetY > row.height * 3 / 4) {
      return "below";
    }

    return "inside";
  }

  constructor(
    options: TreeDropOptions<TData>
  ) {
    this.#snapshot = options.snapshot;
    this.#movedIds = options.movedIds;
    this.#accept = options.accept ?? null;
    this.#rows = options.rows ?? options.snapshot.visibleRows;
  }

  allows(
    targetId: string,
    where: TreeDropWhere
  ): boolean {
    if (this.#movedIds.includes(targetId)) {
      return false;
    }
    if (this.#movedIds.some(
      (movedId) => this.#snapshot.isSelfOrDescendant(movedId, targetId)
    )) {
      return false;
    }

    return this.#accept === null || this.#accept({
      movedIds: this.#movedIds,
      targetId,
      where
    });
  }

  resolve(
    pointer: TreeDropPointer
  ): TreePointerDropPreview | null {
    const { row } = pointer;
    if (row === null) {
      const above = pointer.container !== undefined &&
        pointer.clientY < pointer.container.top;

      return this.#edge(above ? "above" : "below");
    }

    const where = TreeDrop.zone(row, pointer.clientY);
    if (where !== "inside") {
      const edges = this.#edges();
      const edgeRow = where === "below" ? edges.last : edges.first;
      if (edgeRow !== undefined && row.id === edgeRow.node.id) {
        return this.#depth(row.id, pointer, where);
      }
    }

    return this.allows(row.id, where) ?
      {
        targetId: row.id,
        where,
        anchorId: row.id
      } :
      null;
  }

  #depth(
    rowId: string,
    pointer: TreeDropPointer,
    where: "above" | "below"
  ): TreePointerDropPreview | null {
    if (pointer.container === undefined) {
      return null;
    }

    const chain = this.#snapshot.ancestorChain(rowId);
    const depth = Math.floor(
      (pointer.clientX - pointer.container.left) / pointer.indentUnit
    );
    const targetId = chain[Math.min(Math.max(depth, 0), chain.length - 1)];

    return this.allows(targetId, where) ?
      {
        targetId,
        where,
        anchorId: rowId
      } :
      null;
  }

  #edge(
    where: "above" | "below"
  ): TreePointerDropPreview | null {
    const edgeRow = where === "above" ? this.#rows[0] : this.#rows.at(-1);
    if (edgeRow === undefined) {
      return null;
    }

    const direct = this.#snapshot.ancestorChain(edgeRow.node.id)[0];
    if (this.allows(direct, where)) {
      return {
        targetId: direct,
        where,
        anchorId: edgeRow.node.id
      };
    }

    const edges = this.#edges();
    const fallbackRow = where === "above" ? edges.first : edges.last;
    if (fallbackRow === undefined) {
      return null;
    }

    const targetId = this.#snapshot.ancestorChain(fallbackRow.node.id)[0];
    if (!this.allows(targetId, where)) {
      return null;
    }

    return {
      targetId,
      where,
      anchorId: this.#movedIds.includes(edgeRow.node.id) ?
        edgeRow.node.id :
        fallbackRow.node.id
    };
  }

  #edges(): EdgeRows<TData> {
    if (this.#edgeRows !== null) {
      return this.#edgeRows;
    }

    const moved = new Set(
      this.#movedIds.filter((id) => this.#snapshot.node(id) !== null)
    );
    const rows = this.#rows;
    let first = 0;
    while (first < rows.length && this.#isMoved(rows[first], moved)) {
      first += 1;
    }
    if (first === rows.length) {
      this.#edgeRows = {
        first: undefined,
        last: undefined
      };

      return this.#edgeRows;
    }

    let last = rows.length - 1;
    while (last > first && this.#isMoved(rows[last], moved)) {
      last -= 1;
    }
    this.#edgeRows = {
      first: rows[first],
      last: rows[last]
    };

    return this.#edgeRows;
  }

  #isMoved(
    row: FlatTreeRow<TData>,
    moved: ReadonlySet<string>
  ): boolean {
    let id: string | null | undefined = row.node.id;
    while (moved.size > 0 && typeof id === "string" && !moved.has(id)) {
      id = this.#snapshot.parentId(id);
    }

    return moved.size > 0 && typeof id === "string";
  }
}
