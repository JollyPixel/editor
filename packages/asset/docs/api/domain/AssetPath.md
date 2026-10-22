# AssetPath

`AssetPath` is an immutable view of an asset path string, split into a
directory, a name, and an extension. [`AssetRecord`](./AssetRecord.md) stores
its `path` as an `AssetPath`. Asset paths are opaque addresses. This class
does not validate that a path is relative, safe, or supported by a loader.

## API

```ts
class AssetPath {
  readonly directory: string;
  readonly name: string;
  readonly extension: string;

  constructor(path: string);

  withName(name: string): AssetPath;
  withExtension(extension: string): AssetPath;
  withoutExtension(): AssetPath;
  equals(other: AssetPath): boolean;
  toJSON(): string;
  toString(): string;

  static from(path: string | AssetPath): AssetPath;
}
```

The constructor throws `TypeError` for an empty or whitespace-only path. It
splits other strings at their last `/` and at the first `.` of the file name
after its first character. `directory` keeps its trailing slash and
`extension` its leading dot, so the three parts concatenate back to the
original string. The path is not normalized.

| Path | `directory` | `name` | `extension` |
|---|---|---|---|
| `maps/world.voxelmap.json` | `maps/` | `world` | `.voxelmap.json` |
| `.hidden` | | `.hidden` | |
| `v1.2/readme` | `v1.2/` | `readme` | |

`withName()` places `name` between the current `directory` and `extension`, and
`withExtension()` places `extension` after the current `directory` and `name`.
Both parse the result into a new `AssetPath`, so a value containing `/` or `.`
can move the split points. `withExtension()` throws `TypeError` unless
`extension` is empty or starts with `.`. `withoutExtension()` is
`withExtension("")`.

`from()` constructs a path from a string and returns an existing `AssetPath`
unchanged. `equals()` compares full path strings. `toJSON()` and `toString()`
both return the full path string. Call `toString()` before passing a path to
an API that expects a string, such as `fetch()`.

```ts
const path = new AssetPath("textures/block.pixelart");

path.withName("stone").toString();
// "textures/stone.pixelart"

path.withExtension(".png").toString();
// "textures/block.png"

path.withoutExtension().toString();
// "textures/block"
```
