// Import Third-party Dependencies
import * as THREE from "three";
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  VoxelEngine,
  type VoxelEngineOptions
} from "./VoxelEngine.ts";

export interface VoxelRendererOptions extends VoxelEngineOptions {
  /**
   * Object whose world position prioritizes chunk rebuilds, usually the
   * camera. Sampled once per update; `null` leaves `engine.focus` alone.
   * @default null
   */
  focus?: THREE.Object3D | null;
}

/**
 * Runs a `VoxelEngine` through the actor component lifecycle.
 */
export class VoxelRenderer extends ActorComponent {
  readonly engine: VoxelEngine;

  focus: THREE.Object3D | null;

  #focusPoint = new THREE.Vector3();

  constructor(
    actor: Actor<any>,
    options: VoxelRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "VoxelRenderer"
    });

    const { focus = null, ...engineOptions } = options;

    this.focus = focus;
    this.engine = new VoxelEngine({
      ...engineOptions,
      logger: options.logger ?? actor.world.logger
    });
  }

  awake(): void {
    this.actor.object3D.add(this.engine.root);
    this.engine.init();
  }

  update(
    deltaTime: number
  ): void {
    this.#sampleFocus();
    this.engine.tick(deltaTime);
  }

  #sampleFocus(): void {
    const { focus } = this;
    if (focus === null) {
      return;
    }

    focus.getWorldPosition(this.#focusPoint);
    this.engine.root.worldToLocal(this.#focusPoint);
    this.engine.focus = this.#focusPoint;
  }

  override destroy(): void {
    this.actor.object3D.remove(this.engine.root);
    this.engine.dispose();

    super.destroy();
  }
}
