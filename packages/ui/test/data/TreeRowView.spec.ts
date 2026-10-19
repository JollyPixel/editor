// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type { TreeNode } from "../../src/data/tree/contract.ts";
import type { FlatTreeRow } from "../../src/data/tree/model.ts";
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
  dropIndent: TreeRowView.indentStyle(1),
  dragSource: false,
  moveCursor: false,
  renaming: false,
  renameError: null,
  spacer: "inside",
  rails: ["tee"],
  swatchPosition: "end",
  reorderable: true,
  match: null
};

function createRow(
  node: Partial<TreeNode> = {},
  depth = 1
): FlatTreeRow<unknown> {
  return {
    node: {
      ...kNode,
      ...node
    },
    depth,
    parentId: "root"
  };
}

function stateWith(
  state: Partial<TreeRowState> = {}
): TreeRowState {
  return {
    ...kState,
    ...state
  };
}

function createView(
  node: Partial<TreeNode> = {}
): TreeRowView {
  return new TreeRowView(createRow(node), kState);
}

function matches(
  view: TreeRowView,
  node: Partial<TreeNode> = {},
  state: Partial<TreeRowState> = {},
  depth = 1
): boolean {
  return view.matches(createRow(node, depth), stateWith(state));
}

describe("Data.TreeRowView", () => {
  test("rebuilt nodes with the same rendered fields match the view", () => {
    assert.ok(matches(createView(), {
      avatar: { ...kAvatar },
      swatch: { ...kSwatch },
      badges: kBadges.map((badge) => {
        return { ...badge };
      }),
      data: { weight: 2 },
      renamable: true
    }));
  });

  test("any rendered node field no longer matches", () => {
    const changes: Partial<TreeNode>[] = [
      { label: "Villain" },
      { icon: "folder" },
      { avatar: undefined },
      { avatar: { peerId: "lin", color: "#f00" } },
      { avatar: { peerId: "ada", color: "#00f" } },
      { avatar: { ...kAvatar, image: "/ada.webp" } },
      { avatar: { ...kAvatar, presence: "online" } },
      { detail: undefined },
      { visible: false },
      { locked: true },
      { swatch: undefined },
      { swatch: { title: "Tint", color: "#00f" } },
      { swatch: { title: "Tint", color: "#f00", ring: "#fff" } },
      { badges: [] },
      { badges: [{ color: "#0f0" }] },
      { badges: [{ color: "#00f", title: "Peer" }] },
      { badges: [{ color: "#0f0", title: "Peer", icon: "lock" }] },
      { children: [{ id: "arm", label: "Arm" }] },
      { children: [] },
      { selectable: false }
    ];

    for (const change of changes) {
      assert.ok(!matches(createView(), change), JSON.stringify(change));
    }
  });

  test("any row state no longer matches", () => {
    const changes: Partial<TreeRowState>[] = [
      { position: 2 },
      { setSize: 3 },
      { expanded: true },
      { selected: true },
      { active: true },
      { drop: "inside" },
      { dropIndent: TreeRowView.indentStyle(2) },
      { dragSource: true },
      { moveCursor: true },
      { renaming: true },
      { spacer: "outside" },
      { rails: ["elbow"] },
      { swatchPosition: "start" },
      { reorderable: false },
      { match: { start: 0, end: 1 } }
    ];

    for (const change of changes) {
      assert.ok(!matches(createView(), {}, change), JSON.stringify(change));
    }
  });

  test("a heading row is never reorderable, so it shows no grip", () => {
    const heading = createView({ selectable: false });

    assert.equal(heading.selectable, false);
    assert.equal(heading.reorderable, false);
    assert.ok(matches(heading, { selectable: false }));
  });

  test("a deeper row no longer matches", () => {
    assert.ok(!matches(createView(), {}, {}, 2));
  });

  test("a swatch or badge mutated in place no longer matches", () => {
    const swatch = { ...kSwatch };
    const badge = { ...kBadges[0] };
    const node: TreeNode = {
      ...kNode,
      swatch,
      badges: [badge]
    };

    const beforeSwatch = createView(node);
    swatch.color = "#00f";
    assert.ok(!matches(beforeSwatch, node));

    const beforeBadge = createView(node);
    badge.color = "#00f";
    assert.ok(!matches(beforeBadge, node));
  });
});

describe("Data.TreeRowViewList", () => {
  function createRows(
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

  function rowStateSelecting(
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
    const first = list.update(createRows("a", "b"), rowStateSelecting(null));

    assert.equal(list.update(createRows("a", "b"), rowStateSelecting(null)), first);
  });

  test("keeps the views of unchanged rows when another row changes", () => {
    const list = new TreeRowViewList();
    const [a, b] = list.update(createRows("a", "b"), rowStateSelecting(null));
    const next = list.update(createRows("a", "b"), rowStateSelecting("b"));

    assert.equal(next[0], a);
    assert.notEqual(next[1], b);
    assert.equal(next[1].selected, true);
  });

  test("follows rows that are added, removed or reordered", () => {
    const list = new TreeRowViewList();
    const [a, b] = list.update(createRows("a", "b"), rowStateSelecting(null));
    const next = list.update(createRows("c", "b", "a"), rowStateSelecting(null));

    assert.deepEqual(next.map((view) => view.id), ["c", "b", "a"]);
    assert.equal(next[1], b);
    assert.equal(next[2], a);
    assert.equal(list.indexOf("a"), 2);
    assert.equal(list.indexOf("missing"), -1);
  });

  test("keeps the remaining views stable once a row is removed", () => {
    const list = new TreeRowViewList();
    const [a, , c] = list.update(createRows("a", "b", "c"), rowStateSelecting(null));
    const next = list.update(createRows("a", "c"), rowStateSelecting(null));

    assert.deepEqual(next, [a, c]);
    assert.equal(list.update(createRows("a", "c"), rowStateSelecting(null)), next);
    assert.equal(list.indexOf("b"), -1);
  });
});
