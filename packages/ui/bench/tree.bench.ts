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
  resolveEdgeDropRows
} from "../src/data/tree/model.ts";

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
        `resolveEdgeDropRows ${size}, 1 moved`,
        () => resolveEdgeDropRows(rows, [middleIds[0]], snapshot).lastRow
      )
      .add(
        `resolveEdgeDropRows ${size}, 50 middle`,
        () => resolveEdgeDropRows(rows, middleIds, snapshot).lastRow
      )
      .add(
        `resolveEdgeDropRows ${size}, 50 leading`,
        () => resolveEdgeDropRows(rows, leadingIds, snapshot).firstRow
      );
  }
});

export default suite;

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
