# Build

Turns the text of a script or shader into the JavaScript a game runs.

```ts
import { buildScript, buildShader } from "@jolly-pixel/scripting";

const script = await buildScript(scriptSource);
const shader = await buildShader(shaderSource);
```

## Functions

### buildScript(source: string): Promise\<string\>

Transpiles with TypeScript's `transpileModule`. The `typescript` package,
about 9 MB, loads on the first call, in Node and in a browser alike, so both
give the same output and the same errors.

- Output: ES2022 modules with an inline source map.
- Decorators compile as standard decorators, so `@SceneProperty` declares its
  field through `Symbol.metadata`.
- Imports used only as types are dropped; the rest are checked against
  [`SCRIPT_IMPORTS`](./ScriptImportPolicy.md).

### buildShader(source: string): Promise\<string\>

Strips the types and checks the imports against
[`SHADER_IMPORTS`](./ScriptImportPolicy.md).

- Browser: SWC in strip-only mode
  ([`@swc/wasm-typescript-esm`](https://www.npmjs.com/package/@swc/wasm-typescript-esm)).
- Node: `stripTypeScriptTypes` from `node:module`.

Every line and column keeps its place. TypeScript that needs a transform, such
as an `enum`, is refused. An import without `type` stays even when the shader
uses it only as a type.

## Errors

Both functions reject with a `SourceError` for an error in the source, and
with a [`ScriptImportError`](./ScriptImportPolicy.md#scriptimporterror) for a
refused import.

### SourceError

```ts
interface SourcePosition {
  line: number; // 1-based
  column: number; // 1-based
}

class SourceError extends Error {
  readonly position: SourcePosition | null;
}
```

When the position is known, the message ends with it, such as `(2:14)`.
