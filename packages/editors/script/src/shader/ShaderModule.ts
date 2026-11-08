// Import Third-party Dependencies
import {
  isShaderUniformValue,
  type ShadedMaterial,
  type Shader,
  type ShaderUniformValue,
  type ShaderUniformValues
} from "@jolly-pixel/engine";
import { is } from "@jolly-pixel/utils";
import {
  init as initLexer,
  parse
} from "es-module-lexer";
import * as TSL from "three/tsl";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { stripTypes } from "#stripper";
import { ShaderError } from "./errors/ShaderError.ts";

type MaterialFactory = (inputs: Record<string, unknown>) => unknown;
type UniformInput = THREE.UniformNode<unknown, ShaderUniformValue>;

interface ShaderExports {
  factory: MaterialFactory;
  uniforms: ShaderUniformValues;
}

// CONSTANTS
const kRegistry = Symbol.for("jolly-pixel.shader.modules");
const kModules = new Map<string, object>([
  ["three", THREE],
  ["three/webgpu", THREE],
  ["three/tsl", TSL]
]);
const kModuleUrls = new Map<string, string>();

Reflect.set(globalThis, kRegistry, kModules);

export class ShaderModule implements Shader {
  static async compile(
    source: string,
    name: string
  ): Promise<ShaderModule> {
    const sourceUrl = encodeURI(name);
    const code = await linkImports(await stripTypes(source, name));
    const shader = new ShaderModule(await evaluate(code, sourceUrl), sourceUrl);
    shader.createMaterial().material.dispose();

    return shader;
  }

  readonly uniforms: ShaderUniformValues;

  #factory: MaterialFactory;
  #sourceUrl: string;

  constructor(
    exports: ShaderExports,
    sourceUrl: string
  ) {
    this.#factory = exports.factory;
    this.uniforms = exports.uniforms;
    this.#sourceUrl = sourceUrl;
  }

  createMaterial(
    values: ShaderUniformValues = {}
  ): ShaderModuleMaterial {
    const inputs = new Map(Object.entries(this.uniforms).map(
      ([name, fallback]) => [name, uniformInput(values[name] ?? fallback)]
    ));
    let material: unknown;
    try {
      material = this.#factory(Object.fromEntries(inputs));
    }
    catch (cause) {
      throw ShaderError.thrown(cause, this.#sourceUrl);
    }
    if (!(material instanceof THREE.NodeMaterial)) {
      throw new ShaderError(
        "The default export must return a node material, such as MeshStandardNodeMaterial."
      );
    }

    return new ShaderModuleMaterial(material, inputs);
  }
}

export class ShaderModuleMaterial implements ShadedMaterial {
  readonly material: THREE.NodeMaterial;

  #inputs: ReadonlyMap<string, UniformInput>;

  constructor(
    material: THREE.NodeMaterial,
    inputs: ReadonlyMap<string, UniformInput>
  ) {
    this.material = material;
    this.#inputs = inputs;
  }

  assign(
    values: ShaderUniformValues
  ): void {
    for (const [name, value] of Object.entries(values)) {
      const input = this.#inputs.get(name);
      if (input !== undefined) {
        input.value = ownedValue(value);
      }
    }
  }
}

async function linkImports(
  code: string
): Promise<string> {
  await initLexer();
  let imports: ReturnType<typeof parse>[0];
  try {
    [imports] = parse(code);
  }
  catch (cause) {
    throw ShaderError.thrown(cause, null);
  }

  let linked = code;
  for (const entry of [...imports].reverse()) {
    if (entry.type === "import-meta") {
      continue;
    }
    if (entry.type === "dynamic") {
      throw new ShaderError("A shader cannot import modules dynamically.");
    }
    linked = linked.slice(0, entry.start) +
      moduleUrl(entry.specifier) +
      linked.slice(entry.end);
  }

  return linked;
}

function moduleUrl(
  specifier: string
): string {
  const module = kModules.get(specifier);
  if (module === undefined) {
    const allowed = [...kModules.keys()].map((key) => `"${key}"`).join(", ");
    throw new ShaderError(
      `A shader can only import ${allowed}, not "${specifier}".`
    );
  }

  let url = kModuleUrls.get(specifier);
  if (url === undefined) {
    const names = Object.keys(module).filter((name) => name !== "default");
    const source = [
      `const module = globalThis[Symbol.for("${kRegistry.description}")].get(${JSON.stringify(specifier)});`,
      `const { ${names.map((name, index) => `${JSON.stringify(name)}: _${index}`).join(", ")} } = module;`,
      `export { ${names.map((name, index) => `_${index} as ${JSON.stringify(name)}`).join(", ")} };`
    ].join("\n");
    url = javascriptUrl(source);
    kModuleUrls.set(specifier, url);
  }

  return url;
}

async function evaluate(
  code: string,
  sourceUrl: string
): Promise<ShaderExports> {
  let exports: Record<string, unknown>;
  try {
    exports = await import(
      /* @vite-ignore */
      javascriptUrl(`${code}\n//# sourceURL=${sourceUrl}`)
    );
  }
  catch (cause) {
    throw ShaderError.thrown(cause, sourceUrl);
  }

  const factory = exports.default;
  if (!isMaterialFactory(factory)) {
    throw new ShaderError(
      "A shader must export a default function that returns a node material."
    );
  }

  return {
    factory,
    uniforms: declaredUniforms(exports.uniforms)
  };
}

function isMaterialFactory(
  value: unknown
): value is MaterialFactory {
  return typeof value === "function";
}

function declaredUniforms(
  declared: unknown
): ShaderUniformValues {
  if (declared === undefined) {
    return {};
  }
  if (!is.plainObject(declared)) {
    throw new ShaderError("The uniforms export must be an object of default values.");
  }

  const uniforms: Record<string, ShaderUniformValue> = {};
  for (const [name, value] of Object.entries(declared)) {
    if (!isShaderUniformValue(value)) {
      throw new ShaderError(
        `Uniform "${name}" must be a number, Color, Vector2, Vector3, Vector4 or Texture.`
      );
    }
    uniforms[name] = value;
  }

  return uniforms;
}

function uniformInput(
  value: ShaderUniformValue
): UniformInput {
  return value instanceof THREE.Texture ?
    TSL.texture(value) :
    new THREE.UniformNode(ownedValue(value));
}

function ownedValue(
  value: ShaderUniformValue
): ShaderUniformValue {
  return typeof value === "number" || value instanceof THREE.Texture ?
    value :
    value.clone();
}

function javascriptUrl(
  source: string
): string {
  return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
}
