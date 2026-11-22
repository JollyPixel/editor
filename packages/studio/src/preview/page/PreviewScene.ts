// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";
import { Teardown } from "@jolly-pixel/utils";

export class PreviewScene extends Systems.Scene {
  #teardown = new Teardown();

  constructor() {
    super("asset-preview");
  }

  override awake(): void {
    const { world } = this;

    const environment = world.sceneManager.graph.createEnvironment(world);
    environment.apply(Systems.ENVIRONMENT_PRESETS.studio);

    this.#teardown.defer(() => environment.dispose());
  }

  override destroy(): void {
    this.#teardown.run();
    super.destroy();
  }
}
