# is

Type guards for values that arrive as `unknown`, exported as the `is`
namespace. Use them to narrow; parse whole wire or storage shapes with a
schema instead of chaining guards.

```ts
import { is } from "@jolly-pixel/utils";
```

## `is.object()`

```ts
function object(value: unknown): value is object;
```

`true` for any non-null object, arrays and class instances included.

## `is.plainObject()`

```ts
function plainObject(value: unknown): value is Record<string, unknown>;
```

`true` for objects whose prototype is `Object.prototype` or `null`: object
literals, `JSON.parse` output and `Object.create(null)`. Arrays, class
instances and `null` return `false`.

```ts
is.plainObject({ v: 1 });     // true
is.plainObject([]);           // false
is.plainObject(new Date());   // false
```

## `is.member()`

```ts
function member<const T>(value: unknown, choices: readonly T[]): value is T;
```

`true` when `value` is strictly equal to one of `choices`. The literals of an
`as const` list, or of an inline array, become the narrowed type.

```ts
const kModes = ["light", "dark", "auto"] as const;

if (is.member(stored, kModes)) {
  stored;  // "light" | "dark" | "auto"
}
```
