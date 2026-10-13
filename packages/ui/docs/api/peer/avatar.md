# `jolly-avatar`

`jolly-avatar` draws a peer's avatar in a circle: an uploaded image when there
is one, otherwise a default portrait picked from the peer id. It is hidden from
assistive technology, as it sits next to the peer's name, unless it shows a
[presence](#presence).

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

Attribute `peer-id`. Picks the [default portrait](#default-avatars), and its
color when `color` is empty.

### `color`

CSS color of the default portrait. Empty by default, which uses
`colorFromKey(peerId)`, the color [`peerIdentity`](./identity.md) gives the
same peer.

### `image`

URL of an uploaded image, drawn in place of the portrait and cropped to the
avatar's shape. When it fails to load, the portrait comes back until `image`
changes.

### `presence`

`"online"`, `"offline"`, or empty (the default) for no status. A status draws
a dot in the bottom corner, green while online and gray while offline, and
fades the avatar while offline. The avatar then reads as an image labeled
"Online" or "Offline", with the same tooltip.

## Styling

The avatar is 16px square. `--jolly-avatar-size` changes that, and
`--jolly-avatar-radius` the corner radius of the image or portrait (50% by
default, a circle). The clipped face is exposed as the `frame` part, the image
inside it as the `image` part, the portrait as the `portrait` part and the
status dot as the `presence` part. The dot has a 1px ring in
`--jolly-avatar-presence-ring` (defaults to `--jolly-surface`); set it to the
background behind the avatar.

## Default avatars

There are nine portraits: slime, cat, bear, bunny, frog, ghost, robot, alien and
fox. Each fills the whole avatar: a backdrop in a dark shade of the peer
color, the head in the peer color, cropped by the frame, and eyes in the
backdrop shade. They stay readable from 12px. The portrait comes from hashing
`peerId` with `hashKey`, the hash `colorFromKey` uses. Nine portraits over the
eight default peer colors give every portrait and color pair to some peer id.
Nothing is stored, so every page draws the same avatar for the same peer. A
[tree row](../data/tree.md#showing-a-persons-avatar) draws one through
`TreeNode.avatar`, and [`jolly-presence-stack`](./presence-stack.md) overlaps
them.
