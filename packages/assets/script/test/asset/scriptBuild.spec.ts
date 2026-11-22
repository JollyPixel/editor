// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  init as initLexer,
  parse
} from "es-module-lexer";
import { AssetPath } from "@jolly-pixel/asset";
import type { AssetKindHandler } from "@jolly-pixel/asset-server";
import { ScriptImportError } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import {
  scriptAssetKind,
  shaderAssetKind,
  type ScriptText
} from "#src/index.ts";

// CONSTANTS
const kEncoder = new TextEncoder();
const kDecoder = new TextDecoder();
const kEngineStub = [
  "export class Behavior {}",
  "export function SceneProperty(options) {",
  "  return (value, context) => {",
  "    globalThis.decorated.push([context.kind, context.name, options.type]);",
  "  };",
  "}"
].join("\n");

async function build(
  handler: AssetKindHandler<ScriptText, any, any>,
  source: string
): Promise<string> {
  const state = handler.create("asset");
  handler.load(state, kEncoder.encode(source));
  const bytes = await handler.build!.build(state, kEncoder.encode(source));

  return kDecoder.decode(bytes);
}

function importWithEngineStub(
  code: string
): Promise<Record<string, any>> {
  const linked = code.replaceAll(
    "\"@jolly-pixel/ecs\"",
    JSON.stringify(`data:text/javascript,${encodeURIComponent(kEngineStub)}`)
  );

  return import(`data:text/javascript,${encodeURIComponent(linked)}`);
}

async function specifiers(
  code: string
): Promise<string[]> {
  await initLexer();

  return parse(code)[0].map((entry) => entry.specifier ?? "");
}

describe("script build", () => {
  test("builds a behavior whose property decorators run as standard decorators", async() => {
    const code = await build(scriptAssetKind(), [
      "import { Behavior, SceneProperty } from \"@jolly-pixel/ecs\";",
      "export class Mover extends Behavior {",
      "  @SceneProperty({ type: \"number\" })",
      "  speed = 1;",
      "}"
    ].join("\n"));
    const decorated: unknown[] = [];
    Reflect.set(globalThis, "decorated", decorated);

    const module = await importWithEngineStub(code);
    Reflect.deleteProperty(globalThis, "decorated");

    assert.deepEqual(decorated, [["field", "speed", "number"]]);
    assert.equal(new module.Mover().speed, 1);
  });

  test("builds the template of a new script into its awake and start phases", async() => {
    const handler = scriptAssetKind();
    const state = handler.create("new", new AssetPath("scripts/player.ts"));

    const module = await importWithEngineStub(await build(handler, state.text));

    assert.equal(typeof module.PlayerBehavior.prototype.awake, "function");
    assert.equal(typeof module.PlayerBehavior.prototype.start, "function");
  });

  test("keeps the imports a script uses as values and drops the ones used as types", async() => {
    const code = await build(scriptAssetKind(), [
      "import { Behavior } from \"@jolly-pixel/ecs\";",
      "import type { Enemy } from \"./Enemy.ts\";",
      "import { Target } from \"../ai/Target.ts\";",
      "import { Path } from \"./Path.ts\";",
      "export class Hunter extends Behavior {",
      "  enemy: Enemy | null = null;",
      "  path: Path | null = null;",
      "  target = new Target();",
      "}"
    ].join("\n"));

    assert.deepEqual(await specifiers(code), [
      "@jolly-pixel/ecs",
      "../ai/Target.ts"
    ]);
  });

  test("refuses an import the game does not provide, naming it", async() => {
    const cases: Array<[AssetKindHandler<ScriptText, any, any>, string, string]> = [
      [scriptAssetKind(), "import { chunk } from \"lodash\";\nchunk;", "\"lodash\""],
      [scriptAssetKind(), "await import(\"./Enemy.ts\");", "dynamically"],
      [
        shaderAssetKind(),
        "import { Behavior } from \"@jolly-pixel/ecs\";\nBehavior;",
        "\"@jolly-pixel/ecs\""
      ],
      [shaderAssetKind(), "import { noise } from \"./noise.ts\";\nnoise;", "\"./noise.ts\""]
    ];

    for (const [handler, source, named] of cases) {
      await assert.rejects(
        build(handler, source),
        (error) => error instanceof ScriptImportError && error.message.includes(named),
        source
      );
    }
  });

  test("refuses a syntax error at its line and column", async() => {
    for (const handler of [scriptAssetKind(), shaderAssetKind()]) {
      await assert.rejects(
        build(handler, "export const speed: number = 1;\nexport class {"),
        (error: Error) => error.name === "SourceError" && /\(2:\d+\)$/.test(error.message),
        handler.kind
      );
    }
  });
});
