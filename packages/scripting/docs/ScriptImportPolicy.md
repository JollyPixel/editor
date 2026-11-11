# ScriptImportPolicy

The specifiers a script or shader may import.

```ts
import { SCRIPT_IMPORTS } from "@jolly-pixel/scripting";

await SCRIPT_IMPORTS.check(code); // throws ScriptImportError
```

## Policies

- `SCRIPT_IMPORTS`: `@jolly-pixel/engine`, `three`, `three/webgpu`,
  `three/tsl`, and other scripts by a `./` or `../` path.
- `SHADER_IMPORTS`: `three`, `three/webgpu` and `three/tsl` only.

A dynamic `import()` is always refused. `import.meta` is allowed.

## Constructor

```ts
interface ScriptImportPolicyOptions {
  modules: Iterable<string>; // bare specifiers the game provides
  relative: boolean; // allows ./ and ../ specifiers
}
```

## Methods

### allows(specifier: string): boolean

### check(code: string): Promise\<void\>

Reads the imports of built JavaScript with
[es-module-lexer](https://github.com/guybedford/es-module-lexer) and throws a
`ScriptImportError` for the first one the policy refuses.

### refusal(specifier: string): ScriptImportError

The error `check()` throws for `specifier`. Its message lists the allowed
imports:

```
"lodash" cannot be imported: allowed imports are "three", "three/webgpu", "three/tsl".
```

## isRelativeSpecifier(specifier: string): boolean

Whether `specifier` starts with `./` or `../`.

## ScriptImportError

Extends `Error` with the name `ScriptImportError`.
