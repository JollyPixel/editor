# JSON

## `parseJsonObject()`

```ts
function parseJsonObject(text: string | null): Record<string, unknown>;
```

Parses `text` and returns it when it is a plain object. `null`, invalid JSON,
arrays and primitives all return `{}`. Fits values read from `localStorage`,
where a missing or corrupted entry should fall back to defaults.

```ts
import { parseJsonObject } from "@jolly-pixel/utils";

const stored = parseJsonObject(localStorage.getItem("brush"));
const size = typeof stored.size === "number" ? stored.size : 4;
```
