// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as esbuild from "esbuild";

// Import Internal Dependencies
import {
  InputListener,
  SceneActorComponent,
  SceneProperty,
  getBehaviorMetadata
} from "../../../src/core/components/script/BehaviorDecorators.ts";

type Declare = (
  decorators: Record<string, unknown>,
  sibling: unknown
) => Record<string, { prototype: object; }>;

// CONSTANTS
const kSource = `
export default function declare({ SceneProperty, SceneActorComponent, InputListener }, Sibling) {
  class Base {
    @SceneProperty({ type: "number" })
    speed = 1;
  }

  class Player extends Base {
    @SceneProperty({ type: "string", label: "Name", description: "Shown above the head" })
    name = "hero";

    @SceneActorComponent(Sibling)
    sibling;

    @InputListener("keyboard.down")
    onKeyDown() {}
  }

  return { Base, Player };
}
`;

class Sibling {}

async function declareBehaviors(
  experimentalDecorators: boolean
) {
  const { code } = await esbuild.transform(kSource, {
    loader: "ts",
    format: "esm",
    target: "es2022",
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators
      }
    }
  });
  const module = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  const declare: Declare = module.default;

  return declare({ SceneProperty, SceneActorComponent, InputListener }, Sibling);
}

describe("behavior decorators", () => {
  for (const experimentalDecorators of [true, false]) {
    const mode = experimentalDecorators ? "legacy" : "standard";

    test(`declare members of a ${mode} decorated behavior without leaking into its base class`, async() => {
      const { Base, Player } = await declareBehaviors(experimentalDecorators);

      const player = getBehaviorMetadata(Player.prototype);
      const base = getBehaviorMetadata(Base.prototype);

      assert.deepEqual([...player?.properties ?? []], [
        ["speed", { type: "number", label: "speed", description: "" }],
        ["name", { type: "string", label: "Name", description: "Shown above the head" }]
      ]);
      assert.deepEqual([...player?.components ?? []], [["sibling", Sibling]]);
      assert.deepEqual(player?.inputListeners, [
        { device: "keyboard", event: "down", methodName: "onKeyDown" }
      ]);
      assert.deepEqual([...base?.properties.keys() ?? []], ["speed"]);
      assert.deepEqual(base?.inputListeners, []);
    });
  }
});
