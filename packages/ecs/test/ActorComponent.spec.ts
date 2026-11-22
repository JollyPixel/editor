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
  ActorComponent,
  SignalEvent
} from "../src/index.ts";
import { createHeadlessWorld } from "./helpers/world/headlessWorld.ts";

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
    return this.resolveAsset(reference);
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
  const world = createHeadlessWorld({
    assetCoordinator: { get } as any
  });
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

test("ActorComponent timers stop firing once the component is removed or destroyed", () => {
  const world = createHeadlessWorld();
  const { timers } = world;
  const actor = new Actor(world as any, {
    name: "spawner"
  });
  const removed = new AssetConsumer(actor);
  const destroyed = new AssetConsumer(actor);
  const tick = mock.fn();
  removed.schedule(1, tick, { repeat: true });
  destroyed.schedule(1, tick, { repeat: true });

  actor.removeComponent(removed);
  timers.advance(1);
  destroyed.destroy();
  timers.advance(2);

  assert.strictEqual(tick.mock.callCount(), 1);
  assert.strictEqual(timers.pending, true);

  world.sceneManager.endFrame();

  assert.strictEqual(timers.pending, false);
});

test("ActorComponent.listen calls the listener on the component until it is destroyed", () => {
  const actor = new Actor(createHeadlessWorld() as any, {
    name: "listener"
  });
  const component = new AssetConsumer(actor);
  const signal = new SignalEvent<[amount: number]>();
  const received: [AssetConsumer, number][] = [];
  component.listen(signal, function onDamage(amount) {
    received.push([this, amount]);
  });

  signal.emit(3);
  component.destroy();
  signal.emit(5);

  assert.deepEqual(received, [[component, 3]]);
});
