// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TreeSnapshot } from "../../src/data/tree/model.ts";
import { TreeDrop } from "../../src/data/tree/TreeDrop.ts";
import type {
  TreeDropAccept,
  TreeDropWhere,
  TreeNode
} from "../../src/data/tree/contract.ts";
import type { TreePointerDropPreview } from "../../src/data/tree/interaction.ts";
import { FOLDER_TREE } from "../fixtures/tree.ts";

// CONSTANTS
const kRowHeight = 20;
const kIndent = 16;
const kContainer = {
  top: 0,
  left: 0
};
const kOffsets: Record<TreeDropWhere, number> = {
  above: 2,
  inside: 10,
  below: 18
};

interface Hover {
  id: string;
  where: TreeDropWhere;
  clientX?: number;
}

class DropProbe {
  readonly snapshot: TreeSnapshot;
  readonly drop: TreeDrop;

  constructor(
    nodes: TreeNode[],
    expanded: string[],
    movedIds: string[],
    accept: TreeDropAccept | null = null
  ) {
    this.snapshot = new TreeSnapshot(nodes, new Set(expanded));
    this.drop = new TreeDrop({
      snapshot: this.snapshot,
      movedIds,
      accept
    });
  }

  hover(
    hover: Hover
  ): TreePointerDropPreview | null {
    const index = this.snapshot.visibleRows.findIndex(
      (row) => row.node.id === hover.id
    );
    const top = index * kRowHeight;

    return this.drop.resolve({
      clientX: hover.clientX ?? 0,
      clientY: top + kOffsets[hover.where],
      row: {
        id: hover.id,
        top,
        height: kRowHeight
      },
      container: kContainer,
      indentUnit: kIndent
    });
  }

  past(
    where: "above" | "below"
  ): TreePointerDropPreview | null {
    return this.drop.resolve({
      clientX: 0,
      clientY: where === "above" ? -10 : 1000,
      row: null,
      container: kContainer,
      indentUnit: kIndent
    });
  }
}

describe("Data.TreeDrop hovering a row", () => {
  test("drops above, inside or below the hovered row by its quarters", () => {
    const probe = new DropProbe(FOLDER_TREE, ["r2"], ["c2"]);

    assert.deepEqual(
      probe.hover({ id: "r2", where: "inside" }),
      { targetId: "r2", where: "inside", anchorId: "r2" }
    );
    assert.deepEqual(
      probe.hover({ id: "r1", where: "below" }),
      { targetId: "r1", where: "below", anchorId: "r1" }
    );
  });

  test("refuses a moved row and the rows inside a moved branch", () => {
    const probe = new DropProbe(FOLDER_TREE, ["r2"], ["r2"]);

    assert.equal(probe.hover({ id: "r2", where: "inside" }), null);
    assert.equal(probe.hover({ id: "c1", where: "inside" }), null);
  });

  test("lets the domain veto refuse a structurally valid drop", () => {
    const probe = new DropProbe(FOLDER_TREE, ["r2"], ["r1"], () => false);

    assert.equal(probe.hover({ id: "r2", where: "inside" }), null);
  });
});

describe("Data.TreeDrop at the last row", () => {
  test("climbs to the ancestor whose indent band the pointer sits in", () => {
    const probe = new DropProbe(FOLDER_TREE, ["r2"], ["r1"]);

    assert.deepEqual(
      probe.hover({ id: "c2", where: "below", clientX: 0 }),
      { targetId: "r2", where: "below", anchorId: "c2" }
    );
    assert.deepEqual(
      probe.hover({ id: "c2", where: "below", clientX: kIndent }),
      { targetId: "c2", where: "below", anchorId: "c2" }
    );
    assert.deepEqual(
      probe.hover({ id: "c2", where: "below", clientX: 1000 }),
      { targetId: "c2", where: "below", anchorId: "c2" }
    );
  });

  test("treats the row above moved last rows as the last one", () => {
    assert.deepEqual(
      new DropProbe(FOLDER_TREE, ["r2"], ["c2"])
        .hover({ id: "c1", where: "below", clientX: 0 }),
      { targetId: "r2", where: "below", anchorId: "c1" }
    );
    assert.deepEqual(
      new DropProbe(FOLDER_TREE, ["r2"], ["r2"])
        .hover({ id: "r1", where: "below", clientX: kIndent }),
      { targetId: "r1", where: "below", anchorId: "r1" }
    );
  });

  test("lets the domain veto refuse the climbed band", () => {
    const probe = new DropProbe(FOLDER_TREE, ["r2"], ["r1"], () => false);

    assert.equal(probe.hover({ id: "c2", where: "below", clientX: 0 }), null);
  });

  test("needs the rows container to read the indent band", () => {
    const probe = new DropProbe(FOLDER_TREE, ["r2"], ["r1"]);

    assert.equal(
      probe.drop.resolve({
        clientX: 0,
        clientY: (3 * kRowHeight) + kOffsets.below,
        row: {
          id: "c2",
          top: 3 * kRowHeight,
          height: kRowHeight
        },
        indentUnit: kIndent
      }),
      null
    );
  });
});

describe("Data.TreeDrop past the rows", () => {
  test("drops below the last root, anchored at the last row", () => {
    assert.deepEqual(
      new DropProbe(FOLDER_TREE, ["r2"], ["r1"]).past("below"),
      { targetId: "r2", where: "below", anchorId: "c2" }
    );
    assert.deepEqual(
      new DropProbe(FOLDER_TREE, ["r2"], ["c2"]).past("below"),
      { targetId: "r2", where: "below", anchorId: "c2" }
    );
  });

  test("drops above the first root when the pointer is above the container", () => {
    assert.deepEqual(
      new DropProbe(FOLDER_TREE, ["r2"], ["c1"]).past("above"),
      { targetId: "r1", where: "above", anchorId: "r1" }
    );
  });

  test("falls back to the last root that is not moved", () => {
    assert.deepEqual(
      new DropProbe(FOLDER_TREE, ["r2"], ["r2"]).past("below"),
      { targetId: "r1", where: "below", anchorId: "r1" }
    );
    assert.deepEqual(
      new DropProbe(FOLDER_TREE, [], ["r2"]).past("below"),
      { targetId: "r1", where: "below", anchorId: "r2" }
    );
  });

  test("resolves nothing in an empty tree or when every row moves", () => {
    assert.equal(new DropProbe([], [], []).past("below"), null);
    assert.equal(new DropProbe(FOLDER_TREE, [], ["r1", "r2"]).past("below"), null);
  });
});

describe("Data.TreeDrop edge rows", () => {
  test("only the first and last rows left after the moved ones climb bands", () => {
    const nodes = deepTree(4, 3);
    const snapshot = new TreeSnapshot(nodes, new Set(allIds(nodes)));
    const ids = snapshot.visibleRows.map((row) => row.node.id);

    for (let start = 0; start < ids.length; start += 7) {
      for (const movedIds of [
        [ids[start]],
        ids.slice(0, start + 1),
        ids.slice(start),
        [ids[0], ids[start], ids[ids.length - 1]]
      ]) {
        const available = ids.filter(
          (id) => !movedIds.some((moved) => snapshot.isSelfOrDescendant(moved, id))
        );
        if (available.length === 0) {
          continue;
        }

        const probe = new DropProbe(nodes, allIds(nodes), movedIds);
        const first = available[0];
        const last = available[available.length - 1];
        const middle = available.slice(1, -1).find((id) => id.includes("."));

        assert.equal(probe.hover({ id: last, where: "below" })?.targetId, rootOf(last));
        assert.equal(probe.hover({ id: first, where: "above" })?.targetId, rootOf(first));
        if (middle !== undefined) {
          assert.equal(probe.hover({ id: middle, where: "below" })?.targetId, middle);
        }
      }
    }
  });
});

function rootOf(
  id: string
): string {
  return id.split(".")[0];
}

function deepTree(
  breadth: number,
  depth: number,
  prefix = "n"
): TreeNode[] {
  return Array.from({ length: breadth }, (_, index) => {
    const id = `${prefix}${index}`;

    return depth === 0 ?
      { id, label: id } :
      { id, label: id, children: deepTree(breadth, depth - 1, `${id}.`) };
  });
}

function allIds(
  nodes: readonly TreeNode[]
): string[] {
  return nodes.flatMap((node) => [node.id, ...allIds(node.children ?? [])]);
}
