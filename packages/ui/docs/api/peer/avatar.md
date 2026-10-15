# `jolly-avatar`

`jolly-avatar` draws a peer's avatar in a circle: an uploaded image, otherwise
a default portrait picked from the peer id.

```ts
const avatar = document.createElement("jolly-avatar");
avatar.peerId = identity.peerId;
avatar.color = identity.color;
avatar.image = identity.avatar ?? "";
```

```html
<jolly-avatar peer-id="peer-42"></jolly-avatar>
```

## Properties

```ts
interface Avatar {
  peerId: string; // attribute peer-id, picks the default portrait
  color: string; // portrait colour, default colorFromKey(peerId)
  image: string; // uploaded image URL, replaces the portrait
  presence: "online" | "offline" | "";
}
```

- `color` defaults to the colour [`peerIdentity`](./identity.md) gives the
  same peer.
- An `image` that fails to load falls back to the portrait until it changes.
- `presence` draws a dot, green online and grey offline, and fades the avatar
  while offline.
- The avatar is hidden from assistive technology, since it sits next to the
  peer's name. With a `presence`, it reads as an image labelled "Online" or
  "Offline".

## Default portraits

- Nine portraits: slime, cat, bear, bunny, frog, ghost, robot, alien, fox.
- The portrait is picked by hashing `peerId` with `hashKey`, the hash behind
  `colorFromKey`. Nothing is stored, so every page draws the same avatar for
  the same peer.
- They stay readable from 12px.

## Styling

- `--jolly-avatar-size`: default `16px`.
- `--jolly-avatar-radius`: default `50%`.
- `--jolly-avatar-presence-ring`: the dot's 1px ring, default
  `--jolly-surface`. Set it to the background behind the avatar.
- Parts: `frame`, `image`, `portrait`, `presence`.

Also drawn by [tree rows](../data/tree.md#row-content) and
[`jolly-presence-stack`](./presence-stack.md).
