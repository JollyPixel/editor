// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import * as CorePackage from "../../src/core/index.ts";

interface SpriteScene {
  sprites: string[];
}

declare const canvas: HTMLCanvasElement;
declare const backend: CorePackage.RuntimeBackend<
  CorePackage.RuntimeWorld,
  SpriteScene
>;

test("RuntimeCore loads the scene type of its backend", () => {
  const runtime = new CorePackage.RuntimeCore(canvas, backend);

  expect(runtime.load).type.toBeCallableWith({
    scene: { sprites: [] }
  });
  expect(runtime.load).type.not.toBeCallableWith({
    scene: { name: "level" }
  });
});
