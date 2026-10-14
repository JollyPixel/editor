// Import Internal Dependencies
import type { TreeNode } from "./contract.ts";
import type {
  SearchMatch,
  SearchQuery
} from "../../search/SearchQuery.ts";

interface KeptNode<TData> {
  node: TreeNode<TData>;
  hit: boolean;
}

interface KeptList<TData> {
  nodes: TreeNode<TData>[];
  hit: boolean;
}

export class TreeFilter<TData = unknown> {
  readonly query: SearchQuery;
  readonly nodes: readonly TreeNode<TData>[];
  readonly matches: ReadonlyMap<string, Readonly<SearchMatch>>;

  constructor(
    nodes: readonly TreeNode<TData>[],
    query: SearchQuery
  ) {
    const matches = new Map<string, Readonly<SearchMatch>>();
    this.query = query;
    this.matches = matches;
    this.nodes = query.isEmpty ?
      nodes :
      keepMatching(nodes, query, matches, false).nodes;
    Object.freeze(this);
  }
}

function keepMatching<TData>(
  list: readonly TreeNode<TData>[],
  query: SearchQuery,
  matches: Map<string, Readonly<SearchMatch>>,
  keepAll: boolean
): KeptList<TData> {
  const nodes: TreeNode<TData>[] = [];
  let hit = false;
  for (const node of list) {
    const kept = keepNode(node, query, matches, keepAll);
    if (kept !== null) {
      nodes.push(kept.node);
      hit ||= kept.hit;
    }
  }

  return {
    nodes,
    hit
  };
}

function keepNode<TData>(
  node: TreeNode<TData>,
  query: SearchQuery,
  matches: Map<string, Readonly<SearchMatch>>,
  keepAll: boolean
): KeptNode<TData> | null {
  const match = query.rangeIn(node.label);
  if (match !== null) {
    matches.set(node.id, Object.freeze(match));
  }

  const children = keepMatching(
    node.children ?? [],
    query,
    matches,
    keepAll || match !== null
  );
  if (children.hit) {
    return {
      node: {
        ...node,
        collapsible: false,
        children: children.nodes
      },
      hit: true
    };
  }

  return match !== null || keepAll ?
    {
      node,
      hit: match !== null
    } :
    null;
}
