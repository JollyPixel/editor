// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  ModelView,
  type ModelViewTexture
} from "../viewer/ModelView.ts";

export interface VoxelModelRendererOptions {
  document: ModelDocument;
  texture: ModelViewTexture;
}

export class VoxelModelRenderer extends ActorComponent {
  readonly view: ModelView;

  constructor(
    actor: Actor<any>,
    options: VoxelModelRendererOptions
  ) {
    super({
      actor,
      typeName: "VoxelModelRenderer"
    });

    this.view = new ModelView({
      document: options.document,
      texture: options.texture,
      requestFrame: () => actor.world.invalidate()
    });
    this.addTeardown(() => this.view.dispose());
  }

  awake(): void {
    this.actor.node.object3D.add(this.view.root);
  }
}
