// Import Internal Dependencies
import type GroupManager from "../../features/groups/GroupManager.ts";
import type { FlatModelNode } from "../treeNodes.ts";
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
  deleteblock: (
    payload: { uuids: string[]; }
  ) => void;
};

export class ModelEventStore extends EditorStore<ModelEventMap> {}
