// Import Internal Dependencies
import {
  World,
  type WorldOptions
} from "../../../src/systems/World.ts";
import { HeadlessRenderer } from "../../../src/systems/rendering/HeadlessRenderer.ts";
import { HeadlessSceneGraph } from "../../../src/systems/scene/HeadlessSceneGraph.ts";

export function createInertInput(): WorldOptions["input"] {
  return {
    connect: () => undefined,
    disconnect: () => undefined,
    sample: () => undefined,
    publish: () => undefined,
    exited: false
  } as unknown as WorldOptions["input"];
}

export function createHeadlessWorld(
  options: Partial<WorldOptions> = {}
): World {
  return new World(
    new HeadlessRenderer({} as HTMLCanvasElement),
    {
      graph: new HeadlessSceneGraph(),
      input: createInertInput(),
      assetCoordinator: {} as WorldOptions["assetCoordinator"],
      ...options
    }
  );
}
