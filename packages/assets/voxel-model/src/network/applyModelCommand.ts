// Import Internal Dependencies
import type {
  ModelCommand,
  ModelNodeJSON
} from "./types.ts";

export function applyModelCommand(
  nodes: Map<string, ModelNodeJSON>,
  cmd: ModelCommand
): void {
  switch (cmd.action) {
    case "group-added":
      nodes.set(cmd.uuid, {
        uuid: cmd.uuid,
        name: cmd.name,
        parentUuid: null,
        ...cmd.transform
      });
      break;

    case "group-removed":
      nodes.delete(cmd.uuid);
      break;

    case "group-renamed": {
      const node = nodes.get(cmd.uuid);
      if (node) {
        nodes.set(cmd.uuid, { ...node, name: cmd.name });
      }
      break;
    }

    case "group-reparented": {
      const node = nodes.get(cmd.uuid);
      if (node) {
        nodes.set(cmd.uuid, {
          ...node,
          parentUuid: cmd.parentUuid,
          ...cmd.transform
        });
      }
      break;
    }

    case "group-reparented-local": {
      const node = nodes.get(cmd.uuid);
      if (node) {
        nodes.set(cmd.uuid, { ...node, parentUuid: cmd.parentUuid });
      }
      break;
    }

    case "group-transformed": {
      const node = nodes.get(cmd.uuid);
      if (node) {
        nodes.set(cmd.uuid, {
          ...node,
          ...cmd.transform,
          ...(cmd.flipAxes ? { flipAxes: cmd.flipAxes } : {})
        });
      }
      break;
    }
  }
}
