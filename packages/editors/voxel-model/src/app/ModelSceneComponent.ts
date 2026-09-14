// Import Third-party Dependencies
import * as THREE from "three";
import { ActorComponent, type Actor } from "@jolly-pixel/engine";
import type * as network from "@jolly-pixel/network";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import ModelManager from "../features/groups/ModelManager.ts";
import type GroupManager from "../features/groups/GroupManager.ts";
import type { ModelHookEvent } from "../features/groups/hooks.ts";
import type { FreeFlyCamera } from "../scene/camera/FreeFlyCamera.ts";
import GizmoManager, { type GizmoConfig } from "../features/transform/GizmoManager.ts";
import { GroupSelectionPresence } from "../collaboration/GroupSelectionPresence.ts";
import { GroupTransformGhostSync } from "../collaboration/GroupTransformGhostSync.ts";
import { PeerFrustums } from "../collaboration/PeerFrustums.ts";
import { PeerRoster } from "../collaboration/PeerRoster.ts";
import type { EditorIdentity } from "../collaboration/identity.ts";
import { ModelSyncClient } from "../network/ModelSyncClient.ts";
import type {
  ModelNetworkCommand,
  ModelServerMessage
} from "../network/types.ts";

export type { GizmoMode, GizmoTarget, GizmoSpace, GizmoConfig } from "../features/transform/GizmoManager.ts";

export interface ModelSceneComponentOptions {
  camera: FreeFlyCamera;
  room?: network.Room<ModelNetworkCommand, ModelServerMessage>;
  /** Absent offline, no collaboration is wired up. */
  identity?: EditorIdentity;
}

/**
 * Block creation/selection/texture-push, relocated verbatim from the former
 * `ThreeSceneManager` into the engine's `ActorComponent` lifecycle.
 * `ModelManager`/`GroupManager` themselves are untouched by this move.
 */
export class ModelSceneComponent extends ActorComponent {
  #camera: FreeFlyCamera;
  #cameraRaycaster = new THREE.Raycaster();
  #gizmo!: GizmoManager;
  #modelManager!: ModelManager;
  #room: network.Room<ModelNetworkCommand, ModelServerMessage> | undefined;
  #identity: EditorIdentity | undefined;
  #peerRoster: PeerRoster | undefined;
  #groupSelections: GroupSelectionPresence | undefined;
  #peerFrustums: PeerFrustums | undefined;
  #modelSync: ModelSyncClient | undefined;
  #transformGhosts: GroupTransformGhostSync | undefined;

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
        this.#transformGhosts?.clear();
      },
      onDragProgress: (uuid, transform) => this.#transformGhosts?.publish(uuid, transform)
    });

    this.#modelManager = new ModelManager({
      scene,
      transformControl: this.#gizmo.transformControl
    });
    this.#modelManager.onModelUpdated = this.#onModelHookEvent;

    if (this.#room && this.#identity) {
      this.#peerRoster = new PeerRoster({
        room: this.#room,
        identity: this.#identity
      });
      this.#groupSelections = new GroupSelectionPresence({
        room: this.#room
      });
      this.#peerFrustums = this.actor.world
        .createActor("peer-frustums")
        .addComponentAndGet(PeerFrustums, {
          room: this.#room,
          camera: this.#camera.threeCamera as THREE.PerspectiveCamera
        });

      this.#modelSync = new ModelSyncClient({ room: this.#room });
      this.#modelSync.attach(this.#modelManager);
      this.#modelSync.on("snapshot", this.#onModelSnapshotApplied);

      this.#transformGhosts = this.actor.world
        .createActor("transform-ghosts")
        .addComponentAndGet(GroupTransformGhostSync, {
          room: this.#room,
          modelManager: this.#modelManager
        });
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
          document.dispatchEvent(new CustomEvent("groupCreated", {
            detail: { group, name: event.name, parentId: null }
          }));
        }
        break;
      }

      case "group-removed":
        document.dispatchEvent(new CustomEvent("groupRemoved", {
          detail: { uuid: event.uuid }
        }));
        break;

      case "group-renamed":
        document.dispatchEvent(new CustomEvent("groupRenamed", {
          detail: { uuid: event.uuid, name: event.name }
        }));
        break;

      case "group-reparented":
      case "group-reparented-local":
        document.dispatchEvent(new CustomEvent("groupReparented", {
          detail: { uuid: event.uuid, parentUuid: event.parentUuid }
        }));
        break;

      case "group-transformed": {
        const group = this.#modelManager.getGroupByUUID(event.uuid);
        if (group) {
          document.dispatchEvent(new CustomEvent("groupTransformChanged", { detail: { group } }));
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

    document.dispatchEvent(new CustomEvent("modelSnapshotApplied", { detail: { nodes } }));
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
    this.#peerRoster?.dispose();
    this.#peerRoster = undefined;
    this.#groupSelections?.dispose();
    this.#groupSelections = undefined;
    this.#peerFrustums = undefined;
    this.#transformGhosts = undefined;
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
        this.#dispatchGroupSelected(group);
      }

      return;
    }

    this.#modelManager.selectGroup(null);
    this.#dispatchGroupSelected(null);
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
      this.#modelManager.reparent(group.getGroupUUID(), parentId);
    }

    this.#modelManager.selectGroup(group);
    this.#dispatchGroupSelected(group);

    return group;
  }

  public removeBlock(uuid: string): void {
    const group = this.#modelManager.getGroupByUUID(uuid);
    if (!group) {
      return;
    }

    this.#modelManager.removeGroup(group);
  }

  #dispatchGroupSelected(
    group: GroupManager | null
  ): void {
    document.dispatchEvent(new CustomEvent("groupSelected", {
      detail: { group }
    }));
  }

  public getModelManager(): ModelManager {
    return this.#modelManager;
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
