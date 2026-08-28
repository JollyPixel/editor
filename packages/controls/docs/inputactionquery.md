# InputActionQuery

`InputActionQuery` dispatches a value, `"ANY"`, or `"NONE"` to the matching
handler. It is a small helper for implementing APIs such as the sentinel-aware
mouse and keyboard queries.

```ts
import { InputActionQuery } from "@jolly-pixel/controls";

const pressed = new Set(["KeyA"]);
const query = new InputActionQuery<string>("ANY");

const matches = query.match({
  any: () => pressed.size > 0,
  none: () => pressed.size === 0,
  value: (key) => pressed.has(key)
});
```

## Constructor and state

```ts
class InputActionQuery<TAction> {
  readonly isAny: boolean;
  readonly isNone: boolean;
  readonly value: TAction | null;

  constructor(
    action: TAction | "ANY" | "NONE"
  );
}
```

`isAny` is true only for `"ANY"`; `isNone` is true only for `"NONE"`.
`value` is `null` for either sentinel and contains the original action for
every other value.

The constructor does not validate ordinary action values.

## Matching

```ts
match(
  handlers: {
    any: () => boolean;
    none: () => boolean;
    value: (action: TAction) => boolean;
  }
): boolean
```

`match()` calls exactly one handler. It dispatches `"ANY"` to `any`,
`"NONE"` to `none`, and an ordinary action to `value`. The selected
handler's boolean result is returned unchanged.
