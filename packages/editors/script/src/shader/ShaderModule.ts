// Import Third-party Dependencies
import { SHADER_IMPORTS } from "@jolly-pixel/asset.script/client";
import {
  isShaderUniformValue,
  type ShadedMaterial,
  type Shader,
  type ShaderUniformValue,
  type ShaderUniformValues
} from "@jolly-pixel/engine";
import { is } from "@jolly-pixel/utils";
import * as TSL from "three/tsl";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { ShaderError } from "./errors/ShaderError.ts";
import {
  importModule,
  linkModule,
  moduleUrl
} from "../modules/linkModule.ts";
import {
  ModuleRegistry,
  THREE_NAMESPACES
} from "../modules/ModuleRegistry.ts";

type MaterialFactory = (inputs: Record<string, unknown>) => unknown;
type UniformInput = THREE.UniformNode<unknown, ShaderUniformValue>;

interface ShaderExports {
  factory: MaterialFactory;
  uniforms: ShaderUniformValues;
}

// CONSTANTS
const kModules = new ModuleRegistry(SHADER_IMPORTS, THREE_NAMESPACES);

export class ShaderModule implements Shader {
  static async load(
    code: string,
    name: string
  ): Promise<ShaderModule> {
    const sourceUrl = encodeURI(name);
    const linked = await linkImports(code);
    const shader = new ShaderModule(await evaluate(linked, sourceUrl), sourceUrl);
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
  try {
    return await linkModule(code, (specifier) => kModules.url(specifier));
  }
  catch (cause) {
    throw ShaderError.thrown(cause, null);
  }
}

async function evaluate(
  code: string,
  sourceUrl: string
): Promise<ShaderExports> {
  let exports: Record<string, unknown>;
  try {
    exports = await importModule(moduleUrl(code, sourceUrl));
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
