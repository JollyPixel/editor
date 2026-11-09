// Import Node.js Dependencies
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AssetCatalog,
  AssetCoordinator,
  AssetLoaderRegistry,
  AssetRecord,
  AssetReference
} from "@jolly-pixel/asset";
import {
  Behavior,
  SCRIPT_MODULE_ASSET,
  type ScriptModule
} from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ScriptModuleLoader } from "../../src/runtime/ScriptModuleLoader.ts";

class FakeProgressEvent extends Event {
  readonly lengthComputable = false;
  readonly loaded = 0;
  readonly total = 0;
}

function game(
  scripts: Readonly<Record<string, string>>
) {
  const records = Object.keys(scripts).map((path, index) => new AssetRecord({
    id: `script-${index}`,
    kind: "script",
    path
  }));
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (
    Object.hasOwn(scripts, url) ?
      `data:text/javascript,${encodeURIComponent(scripts[url])}` :
      url
  ));
  const coordinator = new AssetCoordinator({
    catalog: new AssetCatalog(records),
    loaders: new AssetLoaderRegistry()
      .register(SCRIPT_MODULE_ASSET, new ScriptModuleLoader(manager))
  });

  return {
    load(path: string): Promise<ScriptModule> {
      const record = records.find((script) => script.path.toString() === path)!;

      return coordinator.load(new AssetReference(record.id, SCRIPT_MODULE_ASSET));
    }
  };
}

describe("ScriptModuleLoader", () => {
  const previous = globalThis.ProgressEvent;
  before(() => {
    globalThis.ProgressEvent = FakeProgressEvent;
  });
  after(() => {
    globalThis.ProgressEvent = previous;
  });

  test("loads a behavior that extends the game's engine and imports scripts by relative path", async() => {
    const { load } = game({
      "scripts/Player.ts": [
        "import { Behavior } from \"@jolly-pixel/engine\";",
        "import { speed } from \"./tuning/speed.js\";",
        "import { label } from \"../shared/label\";",
        "export class Player extends Behavior {}",
        "export const tuning = { speed, label };"
      ].join("\n"),
      "scripts/tuning/speed.ts": "export const speed = 4;",
      "shared/label.ts": "export const label = \"hero\";"
    });

    const { Player, tuning } = await load("scripts/Player.ts");

    assert.ok(typeof Player === "function" && Player.prototype instanceof Behavior);
    assert.deepEqual(tuning, {
      speed: 4,
      label: "hero"
    });
  });

  test("evaluates a script once, however many scripts import it", async() => {
    const { load } = game({
      "Counter.ts": "export const counter = { count: 0 };",
      "Left.ts": "import { counter } from \"./Counter.ts\"; counter.count++; export const left = counter;",
      "Right.ts": "import { counter } from \"./Counter.ts\"; counter.count++; export const right = counter;"
    });

    const [{ left }, { right }] = await Promise.all([load("Left.ts"), load("Right.ts")]);

    assert.strictEqual(left, right);
    assert.deepEqual(left, { count: 2 });
  });

  test("refuses scripts that import each other, naming them", async() => {
    const { load } = game({
      "Hunter.ts": "import { Prey } from \"./Prey.ts\"; export class Hunter { prey = Prey; }",
      "Prey.ts": "import { Hunter } from \"./Hunter.ts\"; export class Prey { hunter = Hunter; }"
    });

    await assert.rejects(
      load("Hunter.ts"),
      /Scripts import each other: "Prey\.ts" → "Hunter\.ts" → "Prey\.ts"/
    );
  });

  test("refuses an import that names no script of the game", async() => {
    const { load } = game({
      "Player.ts": "import { Enemy } from \"./Enemy.ts\"; export const enemy = Enemy;"
    });

    await assert.rejects(
      load("Player.ts"),
      /"Player\.ts" imports "\.\/Enemy\.ts", which is no script of the game/
    );
  });
});
