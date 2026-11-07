# DOM

Helpers that need a `document`, exported from `@jolly-pixel/utils/dom` so the
root entry point stays usable in Node.js.

## `saveFile()`

```ts
function saveFile(blob: Blob, fileName: string): void;
```

Downloads `blob` under `fileName` through a temporary object URL, revoked on
the next task once the download has started.

```ts
import { saveFile } from "@jolly-pixel/utils/dom";

saveFile(new Blob([bytes], { type: "audio/ogg" }), "door-slam.ogg");
```
