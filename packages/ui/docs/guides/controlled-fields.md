# Controlled fields

Field values belong to the application. A field renders its `value` property
and emits an intent when a user edits it:

```ts
const field = document.querySelector("jolly-number");

field.value = 0.5;
field.addEventListener("jolly-change", (event) => {
  field.value = event.detail.value;
});
```

`jolly-input` reports continuous interaction. `jolly-change` reports a commit.
Both events bubble and cross shadow boundaries.

Text-based fields keep a draft while editing. Enter or blur commits the draft.
Escape discards it. A focused draft remains visible when an external value
arrives.

`Mixed` represents different values across a multi-selection:

```ts
import { Mixed, isMixed } from "@jolly-pixel/ui";

field.value = Mixed;
if (isMixed(field.value)) {
  // The selected objects do not share one value.
}
```

Fields also accept validation, default, lock, and peer state. The full property
table is in the [shared field API](../api/field/shared-field-api.md).
