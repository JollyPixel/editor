// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { TreeNode } from "../../src/data/tree/contract.ts";
import {
  TreeRowView,
  TreeRowViewList,
  type TreeRowState
} from "../../src/data/tree/TreeRowView.ts";

// CONSTANTS
const kSwatch = {
  title: "Tint",
  color: "#f00"
};
const kBadges = [{ color: "#0f0", title: "Peer" }];
const kAvatar = {
  peerId: "ada",
  color: "#f00"
};
const kNode: TreeNode = {
  id: "hero",
  label: "Hero",
  icon: "file",
  detail: "Model",
  visible: true,
  locked: false,
  avatar: kAvatar,
  swatch: kSwatch,
  badges: kBadges,
  data: { weight: 1 }
};
const kState: TreeRowState = {
  position: 1,
  setSize: 2,
  expanded: false,
  selected: false,
  active: false,
  drop: null,
  dropIndent: TreeRowView.indentOf(1),
  dragSource: false,
  moveCursor: false,
  renaming: false,
  renameError: null,
  hasBranches: true,
  swatchPosition: "end",
  reorderable: true
};

function viewOf(
  node: Partial<TreeNode> = {},
  state: Partial<TreeRowState> = {},
  depth = 1
): TreeRowView {
  return new TreeRowView(
    {
      node: {
        ...kNode,
        ...node
      },
      depth,
      parentId: "root"
    },
    {
      ...kState,
      ...state
    }
  );
}

describe("Data.TreeRowView", () => {
  test("rebuilt nodes with the same rendered fields give equal views", () => {
    assert.ok(viewOf().equals(viewOf({
      avatar: { ...kAvatar },
      swatch: { ...kSwatch },
      badges: kBadges.map((badge) => {
        return { ...badge };
      }),
      data: { weight: 2 },
      renamable: true
    })));
  });

  test("any rendered node field makes the views differ", () => {
    const changes: Partial<TreeNode>[] = [
      { label: "Villain" },
      { icon: "folder" },
      { avatar: undefined },
      { avatar: { peerId: "lin", color: "#f00" } },
      { avatar: { peerId: "ada", color: "#00f" } },
      { avatar: { ...kAvatar, image: "/ada.webp" } },
      { detail: undefined },
      { visible: false },
      { locked: true },
      { swatch: undefined },
      { swatch: { title: "Tint", color: "#00f" } },
      { swatch: { title: "Tint", color: "#f00", ring: "#fff" } },
      { badges: [] },
      { badges: [{ color: "#0f0" }] },
      { badges: [{ color: "#00f", title: "Peer" }] },
      { children: [{ id: "arm", label: "Arm" }] }
    ];

    for (const change of changes) {
      assert.ok(!viewOf().equals(viewOf(change)), JSON.stringify(change));
    }
  });

  test("any row state makes the views differ", () => {
    const changes: Partial<TreeRowState>[] = [
      { position: 2 },
      { setSize: 3 },
      { expanded: true },
      { selected: true },
      { active: true },
      { drop: "inside" },
      { dropIndent: TreeRowView.indentOf(2) },
      { dragSource: true },
      { moveCursor: true },
      { renaming: true },
      { hasBranches: false },
      { swatchPosition: "start" },
      { reorderable: false }
    ];

    for (const change of changes) {
      assert.ok(!viewOf().equals(viewOf({}, change)), JSON.stringify(change));
    }
  });

  test("a deeper row differs", () => {
    assert.ok(!viewOf().equals(viewOf({}, {}, 2)));
  });

  test("a swatch or badge mutated in place still makes the views differ", () => {
    const swatch = { ...kSwatch };
    const badge = { ...kBadges[0] };
    const node: TreeNode = {
      ...kNode,
      swatch,
      badges: [badge]
    };

    const beforeSwatch = viewOf(node);
    swatch.color = "#00f";
    assert.ok(!beforeSwatch.equals(viewOf(node)));

    const beforeBadge = viewOf(node);
    badge.color = "#00f";
    assert.ok(!beforeBadge.equals(viewOf(node)));
  });
});

describe("Data.TreeRowViewList", () => {
  function rowsOf(
    ...ids: string[]
  ) {
    return ids.map((id) => {
      return {
        node: {
          id,
          label: id
        },
        depth: 0,
        parentId: null
      };
    });
  }

  function stateOf(
    selectedId: string | null
  ): (row: { node: TreeNode; }) => TreeRowState {
    return (row) => {
      return {
        ...kState,
        selected: row.node.id === selectedId
      };
    };
  }

  test("returns the same list while no row changes", () => {
    const list = new TreeRowViewList();
    const first = list.update(rowsOf("a", "b"), stateOf(null));

    assert.equal(list.update(rowsOf("a", "b"), stateOf(null)), first);
  });

  test("keeps the views of unchanged rows when another row changes", () => {
    const list = new TreeRowViewList();
    const [a, b] = list.update(rowsOf("a", "b"), stateOf(null));
    const next = list.update(rowsOf("a", "b"), stateOf("b"));

    assert.equal(next[0], a);
    assert.notEqual(next[1], b);
    assert.equal(next[1].selected, true);
  });

  test("follows rows that are added, removed or reordered", () => {
    const list = new TreeRowViewList();
    const [a, b] = list.update(rowsOf("a", "b"), stateOf(null));
    const next = list.update(rowsOf("c", "b", "a"), stateOf(null));

    assert.deepEqual(next.map((view) => view.id), ["c", "b", "a"]);
    assert.equal(next[1], b);
    assert.equal(next[2], a);
    assert.equal(list.indexOf("a"), 2);
    assert.equal(list.indexOf("missing"), -1);
  });
});
