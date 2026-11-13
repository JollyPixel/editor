// Import Internal Dependencies
import {
  BlockNode,
  type StoredBlockFields
} from "../model/nodes/BlockNode.ts";

interface StoredBlockAdded {
  action: "node-added";
  node: StoredBlockFields & { kind: "block"; };
}

export function upcastVoxelModelCommand(
  stored: unknown
): unknown {
  if (!isStoredBlockAdded(stored)) {
    return stored;
  }

  return {
    ...stored,
    node: BlockNode.upgrade(stored.node)
  };
}

function isStoredBlockAdded(
  stored: unknown
): stored is StoredBlockAdded {
  return typeof stored === "object" &&
    stored !== null &&
    "action" in stored &&
    stored.action === "node-added" &&
    "node" in stored &&
    typeof stored.node === "object" &&
    stored.node !== null &&
    "kind" in stored.node &&
    stored.node.kind === "block";
}
