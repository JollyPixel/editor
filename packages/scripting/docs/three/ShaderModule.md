# ShaderModule

A loaded shader asset that creates node materials.

```ts
import { loadShader } from "@jolly-pixel/scripting/three";

const shader = await loadShader(source, "shaders/Water.tsl.ts");
const { material } = shader.createMaterial({ speed: 2 });
```

## Shader source

A TypeScript module whose default export returns a node material. It may
import `three`, `three/webgpu` and `three/tsl` only.

```ts
import { color, mix, sin, time, uv } from "three/tsl";
import { Color, MeshStandardNodeMaterial, Texture } from "three/webgpu";

export const uniforms = {
  tint: new Color("#2f6fd6"),
  speed: 1,
  map: new Texture()
};

export default function material({ tint, speed, map }) {
  const material = new MeshStandardNodeMaterial();
  const wave = sin(time.mul(speed).add(uv().x.mul(6))).mul(0.5).add(0.5);
  material.colorNode = mix(tint, color("#d9822b"), wave).mul(map);

  return material;
}
```

`uniforms` is optional. It declares the values a scene component can set and
their defaults: a number, `Color`, `Vector2`, `Vector3`, `Vector4` or
`Texture`. Any other value is refused.

## loadShader(source: string, name: string): Promise\<ShaderModule\>

Strips the types as [`buildShader`](../build.md) does, then calls `ShaderModule.load`. The editor preview uses it, so the
preview and the game run the same code.

## ShaderModule

### static load(code: string, name: string): Promise\<ShaderModule\>

Imports built JavaScript from a `data:` URL named after `name` with
`//# sourceURL`, then creates and disposes one material to check the
default export.

### uniforms: ShaderUniformValues

The declared defaults.

### createMaterial(values?: ShaderUniformValues): ShaderModuleMaterial

Calls the default export with a fresh node for each uniform: `texture(value)`
for a texture, a `UniformNode` otherwise. A value missing from `values` takes
its default. Colors and vectors are cloned.

## ShaderModuleMaterial

### material: THREE.NodeMaterial

### assign(values: ShaderUniformValues): void

Updates the uniforms of a live material. Names the shader does not declare are
ignored.

## Errors

Every failure throws a [`SourceError`](../build.md#sourceerror):

- a syntax error, or an import outside `three`, `three/webgpu` and `three/tsl`;
- an error thrown by the module or its default export, with the line and
  column in the asset;
- a default export that is not a function or returns no node material;
- a `uniforms` export that is not an object, or holds an unsupported value.
