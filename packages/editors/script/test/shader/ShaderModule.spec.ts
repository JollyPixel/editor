// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { SHADER_TEMPLATE } from "@jolly-pixel/asset.script";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ShaderModule } from "../../src/shader/ShaderModule.ts";
import { ShaderError } from "../../src/shader/errors/ShaderError.ts";

// CONSTANTS
const kName = "shaders/Water.tsl.ts";
const kWater = `import { color, uv } from "three/tsl";
import { MeshBasicNodeMaterial, type NodeMaterial } from "three/webgpu";

export default function material(): NodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.colorNode = color("#2f6fd6").mul(uv().x);

  return material;
}
`;

const kInputs = `import { Color, MeshBasicNodeMaterial } from "three/webgpu";

export const uniforms = { speed: 1, tint: new Color("#2f6fd6") };

export default function material(inputs) {
  const material = new MeshBasicNodeMaterial();
  material.userData.inputs = inputs;

  return material;
}
`;

describe("ShaderModule", () => {
  test("builds a new node material from a TypeScript TSL module on each call", async() => {
    const shader = await ShaderModule.compile(kWater, kName);

    const first = shader.createMaterial().material;
    const second = shader.createMaterial().material;

    assert.ok(first instanceof THREE.MeshBasicNodeMaterial);
    assert.ok(first.colorNode !== null);
    assert.notStrictEqual(first, second);
  });

  test("gives each material its own uniform nodes, set from the values or the declared defaults", async() => {
    const shader = await ShaderModule.compile(kInputs, kName);

    const first = shader.createMaterial({ speed: 3 }).material.userData.inputs;
    const second = shader.createMaterial().material.userData.inputs;

    assert.deepEqual(Object.keys(shader.uniforms), ["speed", "tint"]);
    assert.deepEqual([first.speed.value, second.speed.value], [3, 1]);
    assert.strictEqual(second.tint.value.getHexString(), "2f6fd6");
    assert.notStrictEqual(first.tint, second.tint);
    assert.notStrictEqual(first.tint.value, shader.uniforms.tint);
  });

  test("assigns new uniform values to a live material, leaving the others", async() => {
    const shader = await ShaderModule.compile(kInputs, kName);
    const shaded = shader.createMaterial({ speed: 3 });
    const { inputs } = shaded.material.userData;
    const tint = new THREE.Color("#ff0000");

    shaded.assign({ tint, unknown: 2 });

    assert.strictEqual(inputs.speed.value, 3);
    assert.strictEqual(inputs.tint.value.getHexString(), "ff0000");
    assert.notStrictEqual(inputs.tint.value, tint);
  });

  test("compiles the template of a new shader", async() => {
    const shader = await ShaderModule.compile(SHADER_TEMPLATE, kName);

    assert.ok(shader.createMaterial().material instanceof THREE.MeshStandardNodeMaterial);
  });

  test("refuses a module it cannot turn into a node material, at the faulty line", async() => {
    const cases: Array<[source: string, message: RegExp, line: number | null]> = [
      [
        "const speed: number = ;\n",
        /Expression expected/,
        1
      ],
      [
        "import { pass } from \"three/addons/tsl/display/PassNode.js\";\n" +
        "export default () => pass;\n",
        /can only import "three", "three\/webgpu", "three\/tsl", not "three\/addons\//,
        null
      ],
      [
        "export const material = 1;\n",
        /must export a default function/,
        null
      ],
      [
        "export const uniforms = { speed: \"fast\" };\n" +
        "export default () => null;\n",
        /Uniform "speed" must be a number, Color, Vector2, Vector3, Vector4 or Texture/,
        null
      ],
      [
        "import { MeshBasicMaterial } from \"three/webgpu\";\n" +
        "export default () => new MeshBasicMaterial();\n",
        /must return a node material/,
        null
      ],
      [
        "import { color } from \"three/tsl\";\n\n" +
        "export default function material() {\n  return color(\"#fff\").missing();\n}\n",
        /missing is not a function/,
        4
      ]
    ];

    for (const [source, message, line] of cases) {
      await assert.rejects(
        ShaderModule.compile(source, kName),
        (error) => error instanceof ShaderError &&
          message.test(error.message) &&
          (error.position?.line ?? null) === line,
        source
      );
    }
  });
});
