// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import type * as THREE from "three";

// Import Internal Dependencies
import type { TerrainReader } from "../../terrain/Terrain.ts";
import {
  TerrainView,
  type TerrainViewOptions
} from "../../view/TerrainView.ts";

export interface TerrainRendererOptions extends TerrainViewOptions {
  terrain: TerrainReader;
  /**
   * The camera LoD and culling follow; read on every update.
   */
  camera: () => THREE.Camera | null;
}

export class TerrainRenderer extends ActorComponent {
  readonly view: TerrainView;

  #camera: () => THREE.Camera | null;

  constructor(
    actor: Actor<any>,
    options: TerrainRendererOptions
  ) {
    super({
      actor,
      typeName: "TerrainRenderer"
    });

    const {
      terrain,
      camera,
      requestFrame,
      ...viewOptions
    } = options;
    this.#camera = camera;
    this.view = new TerrainView(terrain, {
      ...viewOptions,
      requestFrame: () => {
        actor.world.invalidate();
        requestFrame?.();
      }
    });
  }

  awake(): void {
    this.actor.object3D.add(this.view.root);
  }

  update(): void {
    const camera = this.#camera();
    if (camera !== null) {
      this.view.update(camera);
    }
  }

  override destroy(): void {
    this.actor.object3D.remove(this.view.root);
    this.view.dispose();

    super.destroy();
  }
}
