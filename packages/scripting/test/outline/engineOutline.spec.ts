// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { Behavior } from "@jolly-pixel/engine";

// Import Internal Dependencies
import { compileScript } from "#src/compiler/node.ts";
import { readScriptOutline } from "#src/outline/outliner/node.ts";
import {
  fakeProgressEvents,
  scriptGame
} from "../helpers/ScriptGame.ts";

interface RegisteredProperty {
  key: string;
  type: string;
  label: string;
  description: string;
}

interface RegisteredBehavior {
  name: string;
  properties: RegisteredProperty[];
}

// CONSTANTS
const kBehaviorMetadata = Symbol.for("BehaviorMetadata");
const kScript = `
import { Behavior, SceneProperty } from "@jolly-pixel/engine";

export class Idle extends Behavior {}

export class Player extends Behavior {
  @SceneProperty({ type: "number", label: "Speed", description: "Units per second" })
  speed = 1;

  @SceneProperty({ type: "string[]" })
  tags = ["hero"];

  hidden = 3;
}
`;

function registeredBehaviors(
  module: Readonly<Record<string, unknown>>
): RegisteredBehavior[] {
  const behaviors: RegisteredBehavior[] = [];
  for (const [name, value] of Object.entries(module)) {
    if (typeof value !== "function" || !(value.prototype instanceof Behavior)) {
      continue;
    }

    const decoratorMetadata = Reflect.get(value, Reflect.get(Symbol, "metadata"));
    const metadata = decoratorMetadata === undefined ?
      undefined :
      Reflect.get(decoratorMetadata, kBehaviorMetadata);
    const properties: Map<string, Omit<RegisteredProperty, "key">> =
      metadata?.properties ?? new Map();
    behaviors.push({
      name,
      properties: Array.from(properties, ([key, property]) => {
        return {
          key,
          type: property.type,
          label: property.label,
          description: property.description
        };
      })
    });
  }

  return behaviors;
}

describe("script outline against the engine", () => {
  fakeProgressEvents();

  test("lists the behaviors and scene properties the engine registers for the built script", async() => {
    const outline = await readScriptOutline(kScript);
    const game = scriptGame({
      "Player.ts": await compileScript(kScript)
    });

    const registered = registeredBehaviors(await game.load("Player.ts"));

    assert.deepEqual(
      outline?.behaviors.map(({ name, properties }) => {
        return {
          name,
          properties: properties.map(({ key, type, label, description }) => {
            return {
              key,
              type,
              label,
              description
            };
          })
        };
      }),
      registered
    );
    assert.equal(registered.length, 2);
  });
});
