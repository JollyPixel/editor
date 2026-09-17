# AssetSource

`AssetSource` is an immutable workspace-relative source path, split into a
directory, a file name, and an extension. It parses the path only; path safety
is enforced by the backend that reads or writes it.

## API

```ts
class AssetSource {
  readonly directory: string;
  readonly name: string;
  readonly extension: string;

  constructor(source: string);

  withName(name: string): AssetSource;
  equals(other: AssetSource): boolean;
  toJSON(): string;
  toString(): string;

  static from(source: string | AssetSource): AssetSource;
}
```

The constructor splits `source` at its last `/` and at the first `.` of the
file name after its first character. `directory` keeps its trailing slash and
`extension` its leading dot, so the three parts concatenate back to the
original string.

| Source | `directory` | `name` | `extension` |
|---|---|---|---|
| `maps/world.voxelmap.json` | `maps/` | `world` | `.voxelmap.json` |
| `.hidden` | | `.hidden` | |
| `v1.2/readme` | `v1.2/` | `readme` | |

`withName()` returns a new source with `name` replaced and the same
`directory` and `extension`. `from()` constructs a source from a string and
returns an existing `AssetSource` unchanged. `equals()` compares full paths.
`toJSON()` and `toString()` both return the full path.

```ts
new AssetSource("textures/block.pixelart").withName("stone").toString();
// "textures/stone.pixelart"
```

[`AssetRecord`](./AssetRecord.md) stores its source as a plain string. Wrap it
when a name or extension is needed.
