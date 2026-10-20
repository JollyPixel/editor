# Input layers

`inputLayers` records which keyboard events belong to the UI. While a layer is
open, every `keydown` and `keypress` is claimed in a `window` capture
listener. `keyup` is never claimed.

```ts
interface InputLayerOptions {
  dismiss?: () => boolean;
}

class InputLayers {
  constructor(options?: { target?: () => EventTarget });

  readonly open: boolean;
  push(options?: InputLayerOptions): () => void;
  dismissAll(): boolean;
  blocks(event: Event): boolean;
  onEngage(listener: () => void): () => void;
}

const inputLayers: InputLayers;
```

- `push()` opens a layer and returns an idempotent release.
- `blocks(event)` is `true` for a claimed event, even when a listener closed
  the last layer during its dispatch, as Escape does.
- `onEngage` listeners run when the first layer opens.
- `dismissAll()` calls `dismiss` on every layer, newest first, and returns
  `true` only when all closed. A layer without `dismiss` refuses and stays
  open. On `false`, do not open over it.

## Holders

- `jolly-dialog`, while open. Dismissing it cancels it, unless `dismissible`
  is `false`.
- Every [`PopoverController`](./popover-controller.md) popover, unless
  `claimsInput` is `false`. Dismissing hides it.
- Hover flyouts such as `jolly-tool-button` hold none.

## Keyboard guard

The shape matches the `KeyboardGuard` of `@jolly-pixel/controls`. Wire them
once, and the keyboard ignores keys pressed while a dialog or popover is open:

```ts
import { inputLayers } from "@jolly-pixel/ui";

const dispose = input.keyboard.addGuard(inputLayers);
```
