// Import Internal Dependencies
import type GroupManager from "../../features/groups/GroupManager.ts";
import type { MirrorAxes } from "../../features/groups/mirrorTransform.ts";
import type {
  FlatBlockPlacement,
  FlatFolderNode,
  FlatModelNode
} from "../treeNodes.ts";
import { EditorStore } from "./EditorStore.ts";

export type ModelEventMap = {
  groupCreated: (
    payload: { group: GroupManager; name: string; parentId: string | null; }
  ) => void;
  groupRemoved: (
    payload: { uuid: string; }
  ) => void;
  groupRenamed: (
    payload: { uuid: string; name: string; }
  ) => void;
  groupReparented: (
    payload: { uuid: string; parentUuid: string | null; }
  ) => void;
  groupSelected: (
    payload: { group: GroupManager | null; }
  ) => void;
  groupTransformChanged: (
    payload: { group: GroupManager; }
  ) => void;
  modelSnapshotApplied: (
    payload: { nodes: FlatModelNode[]; }
  ) => void;
  addblock: (
    payload: { name: string; parentId: string | null; }
  ) => void;
  duplicateblock: (
    payload: { sourceUuid: string; uuid: string; name: string; }
  ) => void;
  groupMirrored: (
    payload: { uuid: string; axes: MirrorAxes; }
  ) => void;
  deleteblock: (
    payload: { uuids: string[]; }
  ) => void;
  folderCreated: (
    payload: { uuid: string; name: string; parentId: string | null; }
  ) => void;
  folderRemoved: (
    payload: { uuid: string; }
  ) => void;
  folderRenamed: (
    payload: { uuid: string; name: string; }
  ) => void;
  folderReparented: (
    payload: { uuid: string; parentId: string | null; }
  ) => void;
  blockPlaced: (
    payload: { blockUuid: string; folderId: string; }
  ) => void;
  blockUnplaced: (
    payload: { blockUuid: string; }
  ) => void;
  folderSnapshotApplied: (
    payload: { folders: FlatFolderNode[]; placements: FlatBlockPlacement[]; }
  ) => void;
};

export class ModelEventStore extends EditorStore<ModelEventMap> {}
