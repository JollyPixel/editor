# readScriptOutline

Lists the behaviors of a script and their scene properties, for the scene
inspector.

```ts
import { readScriptOutline } from "@jolly-pixel/scripting";

const outline = await readScriptOutline(`
import { Behavior, SceneProperty } from "@jolly-pixel/engine";

export class Player extends Behavior {
  @SceneProperty({ type: "string[]" })
  tags = ["hero"];
}
`);
// { behaviors: [{ name: "Player", properties: [{ key: "tags", type: "string[]", label: "tags", description: "", default: ["hero"] }] }] }
```

## readScriptOutline(text: string): Promise\<ScriptOutline | null\>

Parses the text with [ts-morph](https://github.com/dsherret/ts-morph) and runs
nothing. The browser build always answers `null`.

A named class is a behavior when it extends `Behavior` or has a scene property.
A scene property is a field decorated with `@SceneProperty({ type })`, where
`type` is a string literal.

- `label`: the `label` option, or the field name.
- `description`: the `description` option, or `""`.
- `default`: read from the field initializer, or `null` when it is missing or
  not a literal.

Defaults the outline reads:

```ts
speed = -0.5; // -0.5
tags = ["hero", "blue"]; // ["hero", "blue"]
spawn = new THREE.Vector3(1, -2, 3); // [1, -2, 3]
tint = new THREE.Color("#ff8800"); // "#ff8800"
target = null; // null
```

## Schemas

`zod/mini` schemas, used to validate an outline
received over the network.

```ts
type ScriptPropertyValue =
  | number | string | boolean
  | (number | string | boolean)[];

interface ScriptProperty {
  key: string;
  type: string;
  label: string;
  description: string;
  default: ScriptPropertyValue | null;
}

interface ScriptBehavior {
  name: string;
  properties: ScriptProperty[];
}

interface ScriptOutline {
  behaviors: ScriptBehavior[];
}
```

- `scriptPropertyValueSchema`
- `scriptPropertySchema`
- `scriptBehaviorSchema`
- `scriptOutlineSchema`

`test/outline/engineOutline.spec.ts` builds a script, runs it against the real
engine and compares the properties it registers with the outline, so a rename
on either side fails there.
