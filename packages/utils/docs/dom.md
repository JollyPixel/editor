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

## `pickFiles()`

```ts
interface PickFilesOptions {
  accept?: string; // the input accept attribute, default ""
  multiple?: boolean; // default false
}

function pickFiles(options?: PickFilesOptions): Promise<File[]>;
```

Opens the browser file chooser through a detached file input. Resolves with
the chosen files, or an empty array when the user cancels. Call it from a user
gesture, such as a click handler, or the browser ignores it.

```ts
import { pickFiles } from "@jolly-pixel/utils/dom";

const [palette] = await pickFiles({ accept: ".gpl,.hex,text/plain" });
if (palette !== undefined) {
  await importPalette(palette);
}
```
