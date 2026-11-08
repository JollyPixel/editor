# Paths

## `fileExtension()`

```ts
function fileExtension(path: string): string;
```

The extension of the last `/` segment of `path`, from its last dot, in lower
case. A name without a dot, or whose only dot is the first character, has no
extension and returns `""`.

```ts
import { fileExtension } from "@jolly-pixel/utils";

fileExtension("sprites/Hero.PNG");     // ".png"
fileExtension("level.voxelmap.json");  // ".json"
fileExtension(".gitignore");           // ""
```
