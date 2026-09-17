# AssetRoom

`AssetRoom` is the immutable network room name of one asset, shared by browser
and server packages. Its string form is `${kind}:${assetId}`.

## API

```ts
class AssetRoom {
  readonly kind: string;
  readonly assetId: AssetId;

  constructor(kind: string, assetId: string | AssetId);

  equals(other: AssetRoom): boolean;
  toJSON(): string;
  toString(): string;

  static parse(roomName: string): AssetRoom | null;
}
```

The constructor throws a `TypeError` when `kind` is empty or contains a colon.
`assetId` is wrapped with `AssetId.from()`, which rejects a blank identifier.

`parse()` splits at the first colon, so later colons stay in the asset ID. It
returns `null` when the separator, the kind, or the asset ID is missing.

`equals()` compares kind and asset ID. `toJSON()` and `toString()` both return
the room name.

```ts
const room = new AssetRoom("model", "hero-model");
room.toString();
// "model:hero-model"

AssetRoom.parse("model:hero:1")?.assetId.value;
// "hero:1"
```
