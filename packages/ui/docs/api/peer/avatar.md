# `jolly-avatar`

`jolly-avatar` draws a peer's avatar: an uploaded image when there is one,
otherwise a default glyph picked from the peer id. It is hidden from assistive
technology, as it sits next to the peer's name.

```ts
import "@jolly-pixel/ui";

const avatar = document.createElement("jolly-avatar");
avatar.peerId = identity.peerId;
avatar.color = identity.color;
avatar.image = identity.avatar ?? "";
```

```html
<jolly-avatar peer-id="peer-42"></jolly-avatar>
```

## Properties

### `peerId`

Attribute `peer-id`. Picks the [default glyph](#default-avatars), and its
color when `color` is empty.

### `color`

CSS color of the default glyph. Empty by default, which uses
`colorFromKey(peerId)`, the color [`peerIdentity`](./identity.md) gives the
same peer.

### `image`

URL of an uploaded image, drawn in place of the glyph and cropped to a rounded
square. When it fails to load, the glyph comes back until `image` changes.

## Styling

The avatar is 16px square. `--jolly-avatar-size` changes that, and
`--jolly-avatar-radius` the corner radius of the image (25% by default). The
image is exposed as the `image` part and the glyph as the `glyph` part.

## Default avatars

There are nine glyphs: slime, cat, bear, bunny, frog, ghost, robot, alien and
fox. Each is a bold silhouette with cut-out eyes, drawn in `currentColor` and
readable from 12px. The glyph comes from hashing `peerId` with `hashKey`, the
hash `colorFromKey` uses. Nine glyphs over the eight default peer colors give
every glyph and color pair to some peer id. Nothing is stored, so every page
draws the same avatar for the same peer. A
[tree row](../data/tree.md#showing-a-persons-avatar) draws one through
`TreeNode.avatar`.
