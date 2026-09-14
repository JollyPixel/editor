// Import Third-party Dependencies
import * as THREE from "three";
import { ActorComponent, type Actor } from "@jolly-pixel/engine";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import ModelManager from "../features/groups/ModelManager.ts";
import type GroupManager from "../features/groups/GroupManager.ts";
import type { FreeFlyCamera } from "../scene/camera/FreeFlyCamera.ts";
import GizmoManager, { type GizmoConfig } from "../features/transform/GizmoManager.ts";

export type { GizmoMode, GizmoTarget, GizmoSpace, GizmoConfig } from "../features/transform/GizmoManager.ts";

export interface ModelSceneComponentOptions {
  camera: FreeFlyCamera;
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

  #texture: THREE.CanvasTexture | null = null;

  constructor(
    actor: Actor,
    options: ModelSceneComponentOptions
  ) {
    super({ actor, typeName: "ModelScene" });
    this.#camera = options.camera;
  }

  awake(): void {
    const scene = this.actor.world.sceneManager.getSource();
    const { renderer } = this.actor.world;

    this.#gizmo = new GizmoManager({
      camera: this.#camera,
      canvas: renderer.canvas,
      getSelectedGroup: () => this.#modelManager.getSelectedGroup()
    });

    this.#modelManager = new ModelManager({
      scene,
      transformControl: this.#gizmo.transformControl
    });
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

    this.#dispatchGroupCreated(group, name, parentId);

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

  #dispatchGroupCreated(
    group: GroupManager,
    name: string = "Block",
    parentId: string | null = null
  ): void {
    document.dispatchEvent(new CustomEvent("groupCreated", {
      detail: { group, name, parentId }
    }));
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
