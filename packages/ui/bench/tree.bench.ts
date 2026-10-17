// Import Third-party Dependencies
import {
  defineSuite,
  mulberry32,
  runSuites
} from "@jolly-pixel/bench";

// Import Internal Dependencies
import type { TreeNode } from "../src/data/tree/contract.ts";
import {
  TreeSnapshot,
  flattenVisible,
  type FlatTreeRow
} from "../src/data/tree/model.ts";
import {
  TreeRowViewList,
  type TreeRowState
} from "../src/data/tree/TreeRowView.ts";
import { TreeDrop } from "../src/data/tree/TreeDrop.ts";

// CONSTANTS
const kSizes = [1_000, 10_000];
const kMaxDepth = 12;

const suite = defineSuite("tree", (bench) => {
  for (const size of kSizes) {
    const { nodes, ids } = randomTree(size);
    const expanded = new Set(ids);
    const snapshot = new TreeSnapshot(nodes, expanded);
    const rows = snapshot.visibleRows;
    const leadingIds = rows.slice(0, 50).map((row) => row.node.id);
    const middleIds = rows
      .slice(Math.floor(rows.length / 2), Math.floor(rows.length / 2) + 50)
      .map((row) => row.node.id);

    bench
      .add(`TreeSnapshot ${size} expanded`, () => new TreeSnapshot(nodes, expanded))
      .add(`TreeSnapshot ${size} collapsed`, () => new TreeSnapshot(nodes))
      .add(`flattenVisible ${size}`, () => flattenVisible(nodes, expanded).length)
      .add(
        `TreeDrop ${size} last row, 1 moved`,
        () => hoverEdge(snapshot, [middleIds[0]], "below")
      )
      .add(
        `TreeDrop ${size} last row, 50 middle`,
        () => hoverEdge(snapshot, middleIds, "below")
      )
      .add(
        `TreeDrop ${size} first row, 50 leading`,
        () => hoverEdge(snapshot, leadingIds, "above")
      );

    const list = new TreeRowViewList();
    const selectedId = rows[Math.floor(rows.length / 2)].node.id;
    let selected = false;
    const rowStateSelecting = createRowState(selectedId, () => selected);
    list.update(rows, rowStateSelecting);
    bench
      .add(
        `TreeRowViewList ${size} unchanged`,
        () => list.update(rows, rowStateSelecting).length
      )
      .add(`TreeRowViewList ${size} one row toggled`, () => {
        selected = !selected;

        return list.update(rows, rowStateSelecting).length;
      });
  }
});

export default suite;

function hoverEdge(
  snapshot: TreeSnapshot,
  movedIds: string[],
  where: "above" | "below"
): string | undefined {
  const rows = snapshot.visibleRows;
  const row = where === "above" ? rows[0] : rows[rows.length - 1];
  const drop = new TreeDrop({
    snapshot,
    movedIds
  });

  return drop.resolve({
    clientX: 0,
    clientY: where === "above" ? 1 : 19,
    row: {
      id: row.node.id,
      top: 0,
      height: 20
    },
    container: {
      top: 0,
      left: 0
    },
    indentUnit: 16
  })?.targetId;
}

function createRowState(
  selectedId: string,
  selected: () => boolean
): (row: FlatTreeRow<unknown>) => TreeRowState {
  return (row) => {
    return {
      position: 1,
      setSize: 1,
      expanded: true,
      selected: row.node.id === selectedId && selected(),
      active: false,
      drop: null,
      dropIndent: "",
      dragSource: false,
      moveCursor: false,
      renaming: false,
      renameError: null,
      spacer: "inside",
      rails: [],
      swatchPosition: "end",
      reorderable: true,
      match: null
    };
  };
}

function randomTree(
  size: number
): { nodes: TreeNode[]; ids: string[]; } {
  const rng = mulberry32();
  const nodes: TreeNode[] = [];
  const ids: string[] = [];
  const stack: TreeNode[][] = [nodes];

  for (let index = 0; index < size; index++) {
    const depth = Math.min(
      stack.length - 1,
      Math.floor(rng() * (kMaxDepth + 1))
    );
    stack.length = depth + 1;
    const node: TreeNode = {
      id: `node-${index}`,
      label: `Node ${index}`,
      children: []
    };
    stack[depth].push(node);
    stack.push(node.children!);
    ids.push(node.id);
  }

  return { nodes, ids };
}

if (import.meta.main) {
  await runSuites([suite]);
}
