# readScriptOutline

Lists the behaviors of a script with their scene properties, signals and
methods, for the scene inspector and Signals pane.

```ts
import { readScriptOutline } from "@jolly-pixel/scripting";

const outline = await readScriptOutline(`
import { Behavior, SceneProperty } from "@jolly-pixel/engine";

export class Player extends Behavior {
  @SceneProperty({ type: "string[]" })
  tags = ["hero"];
}
`);
// { behaviors: [{ name: "Player", properties: [{ key: "tags", type: "string[]", label: "tags", description: "", default: ["hero"] }], signals: [], methods: [] }] }
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

A signal is an instance field typed or initialized as `SignalEvent`. Its
parameters come from the tuple type argument; an unlabeled element is named
`arg<index>`.

```ts
readonly damaged = new SignalEvent<[amount: number, source: string]>();
// { key: "damaged", params: [{ name: "amount", type: "number" }, { name: "source", type: "string" }] }
healed: SignalEvent<[number]>;
// { key: "healed", params: [{ name: "arg0", type: "number" }] }
```

A method is a public instance method other than a lifecycle hook (`bind`,
`awake`, `start`, `update`, `fixedUpdate`, `destroy`, `onDestroy`). A
parameter with no type annotation has the type `""`.

Private (`#name`) and static members are left out of both lists.

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

interface ScriptParameter {
  name: string;
  type: string; // as written in the source, "" without an annotation
}

interface ScriptMember {
  key: string;
  params: ScriptParameter[];
}

interface ScriptBehavior {
  name: string;
  properties: ScriptProperty[];
  signals: ScriptMember[];
  methods: ScriptMember[];
}

interface ScriptOutline {
  behaviors: ScriptBehavior[];
}
```

- `scriptPropertyValueSchema`
- `scriptPropertySchema`
- `scriptParameterSchema`
- `scriptMemberSchema`
- `scriptBehaviorSchema`
- `scriptOutlineSchema`

`test/outline/engineOutline.spec.ts` builds a script, runs it against the real
engine and compares the properties it registers with the outline, so a rename
on either side fails there.
