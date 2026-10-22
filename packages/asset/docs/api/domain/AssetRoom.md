# AssetRoom

`AssetRoom` is the immutable network room name of one asset, shared by browser
and server packages. Its string form is `${kind}:${assetId}`, or
`${kind}@${tag}:${assetId}` for the room of a tagged version.

## API

```ts
class AssetRoom {
  readonly kind: AssetKind;
  readonly assetId: AssetId;
  readonly tag: string | null;

  constructor(
    kind: string | AssetKind,
    assetId: string | AssetId,
    tag?: string | null
  );

  equals(other: AssetRoom): boolean;
  toJSON(): string;
  toString(): string;

  static parse(roomName: string): AssetRoom | null;
}
```

The constructor wraps `kind` with [`AssetKind.from()`](./AssetKind.md), which
rejects a blank kind or one containing a colon or `@`. It throws a `TypeError`
when `tag` is blank or contains a colon. `assetId` is wrapped with
`AssetId.from()`, which rejects a blank identifier. `tag` defaults to `null`.

`parse()` splits at the first colon, so later colons stay in the asset ID. An
`@` before that colon starts the tag. It returns `null` when the separator is
missing or when the constructor would reject a part.

`equals()` compares kind, asset ID and tag, so a tagged room never equals the
room of the current version. `toJSON()` and `toString()` both return the room
name.

```ts
const room = new AssetRoom("model", "hero-model");
room.toString();
// "model:hero-model"

AssetRoom.parse("model:hero:1")?.assetId.value;
// "hero:1"

new AssetRoom("model", "hero-model", "v1").toString();
// "model@v1:hero-model"
```
