// Import Third-party Dependencies
import * as THREE from "three";
import { TransformControls } from "three/examples/jsm/Addons.js";
import { ActorComponent, type Actor } from "@jolly-pixel/engine";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import ModelManager from "./ModelManager.ts";
import type GroupManager from "./GroupManager.ts";
import type { FreeFlyCamera } from "./camera/FreeFlyCamera.ts";

export interface ModelSceneComponentOptions {
  camera: FreeFlyCamera;
}

/**
 * Cube creation/selection/texture-push, relocated verbatim from the former
 * `ThreeSceneManager` into the engine's `ActorComponent` lifecycle.
 * `ModelManager`/`GroupManager` themselves are untouched by this move.
 */
export class ModelSceneComponent extends ActorComponent {
  #camera: FreeFlyCamera;
  #cameraRaycaster = new THREE.Raycaster();
  #transformControl!: TransformControls;
  #modelManager!: ModelManager;

  #isTransformControlsDragging = false;
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

    this.#transformControl = new TransformControls(this.#camera.threeCamera, renderer.canvas);
    this.#transformControl.addEventListener("dragging-changed", (event: any) => {
      this.#isTransformControlsDragging = event.value;
      this.#camera.enabled = !event.value;
    });

    this.#modelManager = new ModelManager({
      scene,
      transformControl: this.#transformControl
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
    if (this.#isTransformControlsDragging) {
      return;
    }

    const viewportPosition = input.mouse.viewportPosition;
    this.#cameraRaycaster.setFromCamera(
      new THREE.Vector2(viewportPosition.x, viewportPosition.y),
      this.#camera.threeCamera
    );

    const meshes = this.#modelManager.getGroups().map((group) => group.getMesh());
    const cubeIntersects = this.#cameraRaycaster.intersectObjects(meshes, false);

    if (cubeIntersects.length > 0) {
      const intersect = cubeIntersects[0];
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

  public createCube(name: string = "Cube"): GroupManager {
    const group = this.#modelManager.addGroup({
      texture: this.#texture
    });

    this.#dispatchGroupCreated(group, name);

    return group;
  }

  #dispatchGroupCreated(
    group: GroupManager,
    name: string = "Cube"
  ): void {
    document.dispatchEvent(new CustomEvent("groupCreated", {
      detail: { group, name }
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

  public setControlsEnabled(enabled: boolean): void {
    this.#camera.enabled = enabled;
    this.#transformControl.enabled = enabled;

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
