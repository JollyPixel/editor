# `jolly-presence-stack`

`jolly-presence-stack` is the compact form of [`jolly-presence`](./presence.md):
one row of overlapping [avatars](./avatar.md), names in tooltips. It suits a
viewport corner.

```ts
const stack = document.createElement("jolly-presence-stack");
stack.peers = toPresencePeers(source.peers, selfId);
stack.max = 6;
stack.selectable = true;
stack.addEventListener("jolly-peer-select", (event) => {
  focusOn(event.detail.clientId);
});
```

## Properties

Same as [`jolly-presence`](./presence.md#properties): `peers`, `max`,
`selectable`, and the same `jolly-peer-select` event.

- Peers are drawn in the given order.
- Peers past `max` collapse into a `+N` circle whose tooltip lists their names.
- A selectable remote avatar is a button labelled "Select" and the name.

## Tooltip

- Hover or focus shows `displayName`, then "(you)" for the local peer and the
  `badge`.
- It starts at the avatar's leading edge, so a stack in a bottom-left corner
  stays in the viewport.

## Accessibility

- The list is labelled with the count, such as "3 people connected".
- A plain avatar reads as an image labelled with the name. `+N` reads as
  "N more" and the hidden names.

## Styling

- Each avatar sits in a 2px ring of the peer `color`, which also separates
  overlapping avatars.
- `--jolly-presence-stack-size`: diameter with the ring, default `32px`.
- `--jolly-presence-stack-overlap`: default `8px`.
- Set `hidden` to remove it, for example while the local peer is alone.
- Parts: `stack`, `peer`, `peer-button`, `avatar`, `tooltip`, `overflow`.
