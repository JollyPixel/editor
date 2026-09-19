// Import Third-party Dependencies
import * as THREE from "three";
import {
  ActorComponent,
  type Actor,
  type OrbitFlyCamera
} from "@jolly-pixel/engine";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import type { PeerIdentity } from "@jolly-pixel/ui";

// Import Internal Dependencies
import ModelManager from "../features/groups/ModelManager.ts";
import type GroupManager from "../features/groups/GroupManager.ts";
import type { ModelHookEvent } from "../features/groups/hooks.ts";
import FolderManager from "../features/folders/FolderManager.ts";
import type { FolderHookEvent } from "../features/folders/hooks.ts";
import GizmoManager, { type GizmoConfig } from "../features/transform/GizmoManager.ts";
import { GroupSelectionPresence } from "../collaboration/GroupSelectionPresence.ts";
import { GroupTransformLiveSync } from "../collaboration/GroupTransformLiveSync.ts";
import { GroupTransformLock } from "../collaboration/GroupTransformLock.ts";
import { PeerFrustums } from "../collaboration/PeerFrustums.ts";
import { PeerSelectionHighlight } from "../collaboration/PeerSelectionHighlight.ts";
import { PeerRoster } from "../collaboration/PeerRoster.ts";
import { ModelSyncClient } from "../network/ModelSyncClient.ts";
import { FolderSyncClient } from "../network/FolderSyncClient.ts";
import type { VoxelModelRoom } from "../network/types.ts";
import { editorState } from "./state/index.ts";

export type { GizmoMode, GizmoTarget, GizmoSpace, GizmoConfig } from "../features/transform/GizmoManager.ts";

export interface ModelSceneComponentOptions {
  camera: OrbitFlyCamera;
  room?: VoxelModelRoom;
  identity?: PeerIdentity;
}

export class ModelSceneComponent extends ActorComponent {
  #camera: OrbitFlyCamera;
  #cameraRaycaster = new THREE.Raycaster();
  #gizmo!: GizmoManager;
  #modelManager!: ModelManager;
  #folderManager!: FolderManager;
  #room: VoxelModelRoom | undefined;
  #identity: PeerIdentity | undefined;
  #peerRoster: PeerRoster | undefined;
  #groupSelections: GroupSelectionPresence | undefined;
  #peerFrustums: PeerFrustums | undefined;
  #modelSync: ModelSyncClient | undefined;
  #folderSync: FolderSyncClient | undefined;
  #transformLive: GroupTransformLiveSync | undefined;
  #transformLock: GroupTransformLock | undefined;

  #texture: THREE.CanvasTexture | null = null;

  constructor(
    actor: Actor,
    options: ModelSceneComponentOptions
  ) {
    super({ actor, typeName: "ModelScene" });
    this.#camera = options.camera;
    this.#room = options.room;
    this.#identity = options.identity;
  }

  awake(): void {
    const scene = this.actor.world.sceneManager.getSource();
    const { renderer } = this.actor.world;

    this.#gizmo = new GizmoManager({
      camera: this.#camera,
      canvas: renderer.canvas,
      getSelectedGroup: () => this.#modelManager.getSelectedGroup(),
      commitTransform: (uuid) => {
        this.#modelManager.commitGroupTransform(uuid);
        this.#transformLive?.clear();
        this.#transformLock?.release();
      },
      onDragProgress: (uuid, transform) => this.#transformLive?.publish(uuid, transform),
      isRemotelyLocked: (uuid) => (this.#transformLock?.lockedBy(uuid) ?? null) !== null,
      claimTransformLock: (uuid) => this.#transformLock?.claim(uuid)
    });

    this.#modelManager = new ModelManager({
      scene,
      transformControl: this.#gizmo.transformControl
    });
    this.#modelManager.onModelUpdated = this.#onModelHookEvent;

    this.#folderManager = new FolderManager();
    this.#folderManager.onFolderUpdated = this.#onFolderHookEvent;

    if (this.#room) {
      this.#folderSync = new FolderSyncClient({
        room: this.#room,
        folderManager: this.#folderManager
      });
      this.#folderSync.on("snapshot", this.#onFolderSnapshotApplied);
    }

    if (this.#room && this.#identity) {
      this.#peerRoster = new PeerRoster({
        room: this.#room,
        identity: this.#identity
      });
      this.#groupSelections = new GroupSelectionPresence({
        room: this.#room
      });
      this.actor.world
        .createActor("peer-selection-highlight")
        .addComponentAndGet(PeerSelectionHighlight, {
          modelManager: this.#modelManager
        });
      this.#peerFrustums = this.actor.world
        .createActor("peer-frustums")
        .addComponentAndGet(PeerFrustums, {
          room: this.#room,
          camera: this.#camera.threeCamera as THREE.PerspectiveCamera
        });

      this.#modelSync = new ModelSyncClient({
        room: this.#room,
        modelManager: this.#modelManager
      });
      this.#modelSync.on("snapshot", this.#onModelSnapshotApplied);

      this.#transformLive = this.actor.world
        .createActor("transform-live")
        .addComponentAndGet(GroupTransformLiveSync, {
          room: this.#room,
          modelManager: this.#modelManager
        });
      this.#transformLock = new GroupTransformLock({ room: this.#room });
    }

    this.#room?.join();
  }

  readonly #onModelHookEvent = (
    event: ModelHookEvent
  ): void => {
    switch (event.action) {
      case "group-added": {
        const group = this.#modelManager.getGroupByUUID(event.uuid);
        if (group) {
          editorState.modelEvents.emit("groupCreated", { group, name: event.name, parentId: null });
        }
        break;
      }

      case "group-removed":
        editorState.modelEvents.emit("groupRemoved", { uuid: event.uuid });
        break;

      case "group-renamed":
        editorState.modelEvents.emit("groupRenamed", { uuid: event.uuid, name: event.name });
        break;

      case "group-reparented":
      case "group-reparented-local":
        editorState.modelEvents.emit("groupReparented", { uuid: event.uuid, parentUuid: event.parentUuid });
        break;

      case "group-transformed": {
        const group = this.#modelManager.getGroupByUUID(event.uuid);
        if (group) {
          editorState.modelEvents.emit("groupTransformChanged", { group });
        }
        if (event.flipAxes) {
          editorState.modelEvents.emit("groupMirrored", { uuid: event.uuid, axes: event.flipAxes });
        }
        break;
      }
    }
  };

  readonly #onModelSnapshotApplied = (): void => {
    const nodes = this.#modelManager.getGroups().map((group) => {
      const uuid = group.getGroupUUID();

      return {
        uuid,
        name: group.name,
        parentUuid: this.#modelManager.getParentUUID(uuid)
      };
    });

    editorState.modelEvents.emit("modelSnapshotApplied", { nodes });
  };

  readonly #onFolderHookEvent = (
    event: FolderHookEvent
  ): void => {
    switch (event.action) {
      case "folder-added":
        editorState.modelEvents.emit("folderCreated", {
          uuid: event.uuid,
          name: event.name,
          parentId: event.parentId
        });
        break;

      case "folder-removed":
        editorState.modelEvents.emit("folderRemoved", { uuid: event.uuid });
        break;

      case "folder-renamed":
        editorState.modelEvents.emit("folderRenamed", { uuid: event.uuid, name: event.name });
        break;

      case "folder-reparented":
        editorState.modelEvents.emit("folderReparented", { uuid: event.uuid, parentId: event.parentId });
        break;

      case "block-placed":
        editorState.modelEvents.emit("blockPlaced", { blockUuid: event.blockUuid, folderId: event.folderId });
        break;

      case "block-unplaced":
        editorState.modelEvents.emit("blockUnplaced", { blockUuid: event.blockUuid });
        break;
    }
  };

  readonly #onFolderSnapshotApplied = (): void => {
    const folders = [...this.#folderManager.getFolders()].map(([uuid, folder]) => {
      return { uuid, name: folder.name, parentId: folder.parentId };
    });
    const placements = [...this.#folderManager.getPlacements()].map(([blockUuid, folderId]) => {
      return { blockUuid, folderId };
    });

    editorState.modelEvents.emit("folderSnapshotApplied", { folders, placements });
  };

  teleportToPeer(
    clientId: string
  ): boolean {
    const pose = this.#peerFrustums?.poseOf(clientId);
    if (pose === undefined) {
      return false;
    }

    this.#camera.teleport(pose);

    return true;
  }

  override destroy(): void {
    this.#modelSync?.destroy();
    this.#modelSync = undefined;
    this.#folderSync?.destroy();
    this.#folderSync = undefined;
    this.#peerRoster?.dispose();
    this.#peerRoster = undefined;
    this.#groupSelections?.dispose();
    this.#groupSelections = undefined;
    this.#peerFrustums = undefined;
    this.#transformLive = undefined;
    this.#transformLock?.dispose();
    this.#transformLock = undefined;
    super.destroy();
  }

  update(): void {
    this.#cameraRayCast();
  }

  #cameraRayCast(): void {
    const { input } = this.actor.world;
    if (!input.mouse.wasJustPressed("left")) {
      return;
    }
    if (this.#gizmo.dragging) {
      return;
    }

    const viewportPosition = input.mouse.viewportPosition;
    this.#cameraRaycaster.setFromCamera(
      new THREE.Vector2(viewportPosition.x, viewportPosition.y),
      this.#camera.threeCamera
    );

    const meshes = this.#modelManager.getGroups().map((group) => group.getMesh());
    const blockIntersects = this.#cameraRaycaster.intersectObjects(meshes, false);

    if (blockIntersects.length > 0) {
      const intersect = blockIntersects[0];
      const mesh = intersect.object as THREE.Mesh;
      const group = this.#modelManager.getGroupByMesh(mesh);

      if (group) {
        this.#modelManager.selectGroup(group);
        editorState.modelEvents.emit("groupSelected", { group });
      }

      return;
    }

    this.#modelManager.selectGroup(null);
    editorState.modelEvents.emit("groupSelected", { group: null });
  }

  public createBlock(
    name: string = "Block",
    parentId: string | null = null
  ): GroupManager {
    const group = this.#modelManager.addGroup({
      texture: this.#texture,
      name
    });

    if (parentId !== null) {
      const physicalParentId = this.#folderManager.resolveNearestNonFolderAncestor(parentId);

      if (physicalParentId === null) {
        this.#modelManager.reparent(group.getGroupUUID(), null);
      }
      else {
        this.#modelManager.reparentAtParentPosition(group.getGroupUUID(), physicalParentId);
      }

      if (this.#folderManager.hasFolder(parentId)) {
        this.#folderManager.placeBlock(group.getGroupUUID(), parentId);
      }
    }

    this.#modelManager.selectGroup(group);
    editorState.modelEvents.emit("groupSelected", { group });

    return group;
  }

  public removeBlock(uuid: string): void {
    const group = this.#modelManager.getGroupByUUID(uuid);
    if (!group) {
      return;
    }

    this.#folderManager.placeBlock(uuid, null);
    this.#modelManager.removeGroup(group);
  }

  public createFolder(
    name: string = "Folder",
    parentId: string | null = null
  ): string {
    return this.#folderManager.addFolder({ name, parentId });
  }

  public removeFolder(uuid: string): void {
    this.#folderManager.removeFolder(uuid);
  }

  public getModelManager(): ModelManager {
    return this.#modelManager;
  }

  public getFolderManager(): FolderManager {
    return this.#folderManager;
  }

  public getTransformLock(): GroupTransformLock | undefined {
    return this.#transformLock;
  }

  public setGizmoMode(config: GizmoConfig | null): void {
    this.#gizmo.setMode(config);
  }

  public setControlsEnabled(enabled: boolean): void {
    this.#camera.enabled = enabled;
    this.#gizmo.setEnabled(enabled);

    const { input } = this.actor.world;
    if (enabled) {
      input.connect();
    }
    else {
      input.disconnect();
    }
  }

  public setCanvasTexture(canvasManager: PixelArtCanvas): void {
    const textureCanvas = canvasManager.textureCanvas();
    this.#texture = new THREE.CanvasTexture(textureCanvas);
    this.#texture.magFilter = THREE.NearestFilter;
    this.#texture.minFilter = THREE.NearestFilter;
    this.#texture.needsUpdate = true;
    this.#texture.generateMipmaps = false;

    this.#modelManager.setTextureForAll(this.#texture);
  }
}
