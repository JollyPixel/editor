// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Behavior } from "@jolly-pixel/engine";

// Import Internal Dependencies
import {
  fakeProgressEvents,
  scriptGame
} from "../helpers/ScriptGame.ts";

describe("ScriptModuleLoader", () => {
  fakeProgressEvents();

  test("loads a behavior that extends the game's engine and imports scripts by relative path", async() => {
    const { load } = scriptGame({
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
    const { load } = scriptGame({
      "Counter.ts": "export const counter = { count: 0 };",
      "Left.ts": "import { counter } from \"./Counter.ts\"; counter.count++; export const left = counter;",
      "Right.ts": "import { counter } from \"./Counter.ts\"; counter.count++; export const right = counter;"
    });

    const [{ left }, { right }] = await Promise.all([load("Left.ts"), load("Right.ts")]);

    assert.strictEqual(left, right);
    assert.deepEqual(left, { count: 2 });
  });

  test("refuses scripts that import each other, naming them", async() => {
    const { load } = scriptGame({
      "Hunter.ts": "import { Prey } from \"./Prey.ts\"; export class Hunter { prey = Prey; }",
      "Prey.ts": "import { Hunter } from \"./Hunter.ts\"; export class Prey { hunter = Hunter; }"
    });

    await assert.rejects(
      load("Hunter.ts"),
      /Scripts import each other: "Prey\.ts" → "Hunter\.ts" → "Prey\.ts"/
    );
  });

  test("refuses an import that names no script of the game", async() => {
    const { load } = scriptGame({
      "Player.ts": "import { Enemy } from \"./Enemy.ts\"; export const enemy = Enemy;"
    });

    await assert.rejects(
      load("Player.ts"),
      /"Player\.ts" imports "\.\/Enemy\.ts", which is no script of the game/
    );
  });
});
