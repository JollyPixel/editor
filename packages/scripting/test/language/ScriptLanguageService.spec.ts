// Import Node.js Dependencies
import { after, describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import files from "@jolly-pixel/scripting/types";

// Import Internal Dependencies
import { ScriptLanguageService } from "#src/language/ScriptLanguageService.ts";

// CONSTANTS
const kScript = `import { Behavior, SceneProperty } from "@jolly-pixel/ecs";
import { Vector3 } from "three";
import { color } from "three/tsl";
import { Enemy } from "./Enemy.ts";

export class Player extends Behavior {
  @SceneProperty({ type: "number" })
  speed = 1;

  target = new Vector3();
  tint = color(1, 0, 0);
  enemy?: Enemy;

  update() {
    this.actor.node.object3D.visible = true;
  }
}
`;

describe("ScriptLanguageService", () => {
  const service = new ScriptLanguageService(files, "scripts/Player.ts");
  after(() => service.dispose());

  test("checks a behavior against the ecs, three.js backend and three types, ignoring other scripts", () => {
    assert.deepEqual(service.diagnostics(kScript), []);
  });

  test("reports a type error at its offset", () => {
    const text = kScript.replace("speed = 1;", "speed = 1;\n  slow: number = \"no\";");

    const [diagnostic] = service.diagnostics(text);

    assert.deepEqual(diagnostic, {
      start: text.indexOf("slow"),
      length: "slow".length,
      severity: "error",
      message: "Type 'string' is not assignable to type 'number'.",
      code: "ts(2322)"
    });
  });

  test("reports an import the game cannot resolve", () => {
    const text = `import { missing } from "missing-module";\n${kScript}`;

    const [diagnostic] = service.diagnostics(text);

    assert.equal(diagnostic.code, "ts(2307)");
  });

  test("completes the members of an engine type that start with the typed word", () => {
    const text = kScript.replace("update() {\n", "update() {\n    this.actor.addCo\n");
    const offset = text.indexOf("addCo") + "addCo".length;

    const completions = service.completions(text, offset);

    assert.ok(completions.length > 0);
    for (const completion of completions) {
      assert.match(completion.name, /^addCo/i);
      assert.equal(completion.start, offset - "addCo".length);
      assert.equal(completion.length, "addCo".length);
    }
  });

  test("describes the symbol under an offset", () => {
    const info = service.quickInfo(kScript, kScript.indexOf("Vector3()") + 1);

    assert.equal(info?.start, kScript.indexOf("Vector3()"));
    assert.match(info?.signature ?? "", /Vector3\(x\?: number/);
  });
});
