// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  VoxelEngine,
  type VoxelEngineOptions
} from "./VoxelEngine.ts";

export {
  VoxelRotation,
  type VoxelLoadOptions,
  type VoxelSetOptions,
  type VoxelRemoveOptions,
  type VoxelLogger
} from "./VoxelEngine.ts";

export type VoxelRendererOptions = VoxelEngineOptions;

/**
 * ActorComponent wrapper around `VoxelEngine`: wires the engine's lifecycle
 */
export class VoxelRenderer extends ActorComponent {
  readonly engine: VoxelEngine;

  constructor(
    actor: Actor<any>,
    options: VoxelRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "VoxelRenderer"
    });

    this.engine = new VoxelEngine({
      ...options,
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
    this.engine.tick(deltaTime);
  }

  override destroy(): void {
    this.actor.object3D.remove(this.engine.root);
    this.engine.dispose();

    super.destroy();
  }
}
