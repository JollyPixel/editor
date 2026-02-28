// Import Third-party Dependencies
import * as THREE from "three";
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import { TransformControls } from "three/addons/controls/TransformControls.js";

// Import Internal Dependencies
import { editorState } from "../EditorState.ts";

export abstract class TransformGizmoBase extends ActorComponent {
  #controls: TransformControls | null = null;
  #helper: THREE.Object3D | null = null;
  #camera: THREE.PerspectiveCamera;

  constructor(
    actor: Actor,
    options: { camera: THREE.PerspectiveCamera; },
    typeName: string
  ) {
    super({
      actor,
      typeName
    });
    this.#camera = options.camera;
  }

  protected get controls(): TransformControls | null {
    return this.#controls;
  }

  protected get camera(): THREE.PerspectiveCamera {
    return this.#camera;
  }

  awake(): void {
    const canvas = this.actor.world.renderer.canvas;

    this.#controls = new TransformControls(this.#camera, canvas);
    this.#controls.setMode("translate");

    this.#helper = this.#controls.getHelper();
    this.actor.addChildren(this.#helper);

    this.#controls.addEventListener("dragging-changed", (event) => {
      editorState.setGizmoDragging(
        (event as THREE.Event & { value: boolean; }).value
      );
    });
  }

  override destroy(): void {
    this.#controls?.detach();
    this.#controls?.dispose();
    this.#controls = null;

    super.destroy();
  }
}
