// Import Node.js Dependencies
import assert from "node:assert/strict";
import { mock, test } from "node:test";

// Import Third-party Dependencies
import {
  AssetReference,
  AssetType
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import {
  Actor,
  ActorComponent
} from "../src/index.ts";
import { createWorld } from "./mocks.ts";

/**
 * Exposes protected asset access for its focused unit test.
 */
class AssetConsumer extends ActorComponent {
  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "AssetConsumer"
    });
  }

  read<TValue>(
    reference: AssetReference<TValue>
  ): TValue {
    return this.getAsset(reference);
  }
}

test("ActorComponent reads a prepared asset synchronously", () => {
  const reference = new AssetReference(
    "dialogue.intro",
    new AssetType<string>("text")
  );
  const get = mock.fn(
    (_reference: AssetReference<string>) => "prepared dialogue"
  );
  const world = {
    ...createWorld(),
    assetCoordinator: { get }
  };
  const actor = new Actor(world as any, {
    name: "reader"
  });
  const component = new AssetConsumer(actor);

  const value: string = component.read(reference);

  assert.equal(value, "prepared dialogue");
  assert.strictEqual(
    get.mock.calls[0].arguments[0],
    reference
  );
});
