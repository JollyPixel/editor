# Presence

`jolly-presence` renders a collaboration snapshot. It owns no transport,
identity, username editing, or color allocation; provide those values from the
host application.

```ts
import {
  Pane,
  type PresencePeer
} from "@jolly-pixel/ui";

const pane = new Pane({ title: "Session" });
const presence = pane.addPresence({ max: 5 });

const peers: PresencePeer[] = [
  {
    id: "local",
    username: "Ada",
    color: "#f94144",
    self: true
  },
  {
    id: "remote-1",
    username: "Lin",
    color: "#43aa8b"
  }
];
presence.update(peers);
```

`Folder` exposes the same `addPresence()` builder. Direct element consumers
can assign `element.peers` and `element.max` instead.

Each peer has a required stable `id`, `username`, and CSS `color`; `self` is
optional and marks the local peer as `(you)`. Input snapshot order is retained.
The component copies the supplied iterable, so later collection mutations need
another update. The runtime tolerates duplicate IDs and multiple `self` flags,
though callers should supply unique IDs and at most one local peer.

The total always includes the local peer and uses “person” for one or “people”
otherwise. An empty snapshot renders `0 people connected`.

`max` defaults to unlimited. Finite values floor and clamp to zero. A cap adds
`+N more` while keeping the total accurate; when `max >= 1`, a hidden local peer
replaces the final visible remote peer. `max = 0` intentionally shows only the
summary and overflow.

The element exposes `summary`, `list`, `peer`, `swatch`, and `overflow` CSS
parts. Its summary is announced through a polite live region.
