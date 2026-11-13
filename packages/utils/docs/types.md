# Types

Type-only helpers, exported from the root entry point.

```ts
import type {
  DeepReadonly,
  DistributiveOmit,
  Simplify
} from "@jolly-pixel/utils";
```

## `DistributiveOmit`

```ts
type DistributiveOmit<TValue, TKey extends PropertyKey>;
```

`Omit` applied to each member of a union. The built-in `Omit` merges a union
into one object of its shared keys, which loses the discriminant's narrowing.

```ts
type Command =
  | { type: "move"; requestId: string; x: number; } |
  { type: "rename"; requestId: string; name: string; };

type Request = DistributiveOmit<Command, "requestId">;
// { type: "move"; x: number; } | { type: "rename"; name: string; }
```

## `DeepReadonly`

```ts
type DeepReadonly<TValue>;
```

Marks every nested property, array and tuple `readonly`. `Uint8Array` and
functions are left as is, so byte payloads can still be handed to APIs that
take a mutable buffer and callbacks stay callable. Meant for plain data:
`Map`, `Set` and other class instances lose their methods.

## `Simplify`

```ts
type Simplify<TValue>;
```

Flattens an intersection or mapped type into a single object type, so editor
hovers show its properties instead of the type's name.
