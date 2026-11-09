// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  init as initLexer,
  parse
} from "es-module-lexer";
import type { AssetKindHandler } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import {
  SCRIPT_TEMPLATE,
  ScriptImportError,
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
  "  return (target, key) => {",
  "    globalThis.decorated.push([target.constructor.name, key, options.type]);",
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

async function specifiers(
  code: string
): Promise<string[]> {
  await initLexer();

  return parse(code)[0].map((entry) => entry.specifier ?? "");
}

describe("script build", () => {
  test("builds a behavior whose property decorators run on its prototype", async() => {
    const code = await build(scriptAssetKind(), SCRIPT_TEMPLATE);
    const decorated: unknown[] = [];
    Reflect.set(globalThis, "decorated", decorated);

    const linked = code.replaceAll(
      "\"@jolly-pixel/engine\"",
      JSON.stringify(`data:text/javascript,${encodeURIComponent(kEngineStub)}`)
    );
    const module = await import(`data:text/javascript,${encodeURIComponent(linked)}`);
    Reflect.deleteProperty(globalThis, "decorated");

    assert.equal(typeof module.NewBehavior, "function");
    assert.deepEqual(decorated, [["NewBehavior", "speed", "number"]]);
    assert.equal(new module.NewBehavior().speed, 1);
  });

  test("keeps the imports a script uses as values and drops the ones used as types", async() => {
    const code = await build(scriptAssetKind(), [
      "import { Behavior } from \"@jolly-pixel/engine\";",
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
      "@jolly-pixel/engine",
      "../ai/Target.ts"
    ]);
  });

  test("refuses an import the game does not provide, naming it", async() => {
    const cases: Array<[AssetKindHandler<ScriptText, any, any>, string, string]> = [
      [scriptAssetKind(), "import { chunk } from \"lodash\";\nchunk;", "\"lodash\""],
      [scriptAssetKind(), "await import(\"./Enemy.ts\");", "dynamically"],
      [
        shaderAssetKind(),
        "import { Behavior } from \"@jolly-pixel/engine\";\nBehavior;",
        "\"@jolly-pixel/engine\""
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
    await assert.rejects(
      build(scriptAssetKind(), "export const speed = 1;\nexport class {"),
      (error: Error) => error.name === "ScriptBuildError" && /\(2:\d+\)$/.test(error.message)
    );
  });
});
