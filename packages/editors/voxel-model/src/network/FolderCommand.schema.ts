// Import Third-party Dependencies
import {
  COMMAND_HEADER_REQUIRED,
  commandHeaderProperties,
  defineMessageProtocol,
  serverMessageProtocol,
  type JSONSchema,
  type MessageProtocol,
  type MessageProtocols
} from "@jolly-pixel/network";

// Import Internal Dependencies
import { FOLDER_HOOK_ACTIONS } from "../features/folders/hooks.ts";

function commandVariant(
  action: string,
  properties: Record<string, JSONSchema>
): JSONSchema {
  return {
    type: "object",
    properties: {
      ...commandHeaderProperties,
      action: { const: action },
      ...properties
    },
    required: [
      ...COMMAND_HEADER_REQUIRED,
      "action",
      ...Object.keys(properties)
    ]
  };
}

const parentIdSchema: JSONSchema = {
  type: ["string", "null"]
};

export const folderNodeSchema: JSONSchema = {
  type: "object",
  properties: {
    uuid: { type: "string" },
    name: { type: "string" },
    parentId: parentIdSchema
  },
  required: ["uuid", "name", "parentId"]
};

export const folderPlacementSchema: JSONSchema = {
  type: "object",
  properties: {
    blockUuid: { type: "string" },
    folderId: { type: "string" }
  },
  required: ["blockUuid", "folderId"]
};

export const folderSnapshotSchema: JSONSchema = {
  type: "object",
  properties: {
    folders: { type: "array", items: folderNodeSchema },
    placements: { type: "array", items: folderPlacementSchema }
  },
  required: ["folders", "placements"]
};

export const folderCommandProtocol: MessageProtocol = defineMessageProtocol({
  schema: {
    oneOf: [
      commandVariant("folder-added", {
        uuid: { type: "string" },
        name: { type: "string" },
        parentId: parentIdSchema
      }),
      commandVariant("folder-removed", {
        uuid: { type: "string" }
      }),
      commandVariant("folder-renamed", {
        uuid: { type: "string" },
        name: { type: "string" }
      }),
      commandVariant("folder-reparented", {
        uuid: { type: "string" },
        parentId: parentIdSchema
      }),
      commandVariant("block-placed", {
        blockUuid: { type: "string" },
        folderId: { type: "string" }
      }),
      commandVariant("block-unplaced", {
        blockUuid: { type: "string" }
      })
    ]
  }
});

export const FOLDER_COMMAND_ACTIONS: readonly string[] = FOLDER_HOOK_ACTIONS;

export const folderProtocols: MessageProtocols = {
  inbound: folderCommandProtocol,
  outbound: serverMessageProtocol({
    command: folderCommandProtocol,
    snapshot: folderSnapshotSchema
  })
};
