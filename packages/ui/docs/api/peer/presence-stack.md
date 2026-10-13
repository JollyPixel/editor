# `jolly-presence-stack`

`jolly-presence-stack` is the compact form of [`jolly-presence`](./presence.md):
one row of overlapping round [avatars](./avatar.md), with each peer's name in a
tooltip. It suits a corner of a viewport, where a list would cover the scene.

```ts
import "@jolly-pixel/ui";

const stack = document.createElement("jolly-presence-stack");
stack.peers = toPresencePeers(source.peers, selfId);
stack.max = 6;
stack.selectable = true;
stack.addEventListener("jolly-peer-select", (event) => {
  focusOn(event.detail.clientId);
});
```

## Properties

### `peers`

`Iterable<PresencePeer>`, empty by default. Assigning it copies the iterable.
The stack draws peers in the given order, so a list built with
[`toPresencePeers`](./presence-source.md#mapping) starts with the local peer.

### `max`

Attribute `max`, `Infinity` by default. It caps the drawn avatars the same way
`jolly-presence` caps its rows: finite values are floored and clamped to zero,
and a local peer past the cap replaces the last visible remote peer. Hidden
peers collapse into a final `+N` circle whose tooltip lists their names.

### `selectable`

Attribute `selectable`, `false` by default. When set, each remote avatar is a
button labeled "Select" followed by the peer's name, and a click raises
`jolly-peer-select` with `{ clientId }`, the event `jolly-presence` raises.
The local peer is never a button.

## Tooltip

Hovering an avatar, or focusing it with the keyboard, shows the peer's
`displayName` above it, followed by "(you)" for the local peer and by `badge`
when there is one. The tooltip starts at the avatar's leading edge, so a stack
placed in a bottom-left corner keeps it inside the viewport.

## Accessibility

The list is labeled with the connection count, such as "3 people connected".
An avatar that is not a button reads as an image labeled with the peer's name,
and the `+N` circle reads as "N more" followed by the hidden names.

## Styling

Each avatar sits in a 2px ring of the peer's `color` and glows softly in the
same color, brighter while hovered or focused. The ring also separates an
avatar from the one it overlaps. `--jolly-presence-stack-size` sets the
diameter, ring included (32px by default), and
`--jolly-presence-stack-overlap` how far each avatar slides under the
previous one (8px by default). Set `hidden` to remove the stack, for example
while the local peer is alone. The parts are
`stack`, `peer`, `peer-button`, `avatar`, `tooltip` and `overflow`.
