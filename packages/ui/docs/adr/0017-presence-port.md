---
status: accepted
---

# `ui` declares a presence port and owns the presence schema

Core `ui` depends on nothing network-related. It declares a `PresenceSource` port and owns
`CollaboratorPresence`, because `PeerMetadata` in `@jolly-pixel/network` is an untyped
`Record<string, unknown>`. A separate `@jolly-pixel/ui/network` subpath ships the adapter mapping a
`Room` onto the port, importing `@jolly-pixel/network/client` rather than the root entry.

Fields discover their source through a bubbling, `composed` request event, re-asked rather than
answered once. `jolly-presence` stays a transport-free snapshot view: a host hands it ordered peers,
and it renders the count, swatches, `(you)` and `+N more`.

## Considered Options

- **Depending on `@jolly-pixel/network` from core.** The root entry drags `Server.ts` and its `ws`
  dependency into browser bundles.
- **`@lit/context` for the presence lookup.** A bubbling composed request event is what it does
  internally, and the dependency table is deliberately three lines long.
- **Answering the presence request once, at connect.** A field connects before its pane is handed a
  source, so every field would stay permanently sourceless.
- **`jolly-presence` reading a source itself.** A host may want to filter or relabel a session list;
  locks are per field and derived, avatars are not.
- **Unifying `CollaboratorPresence` and `PresencePeer`.** They diverge in both directions — `self` is
  view-only, `editing` is port-only — so each would carry a field the other must ignore.

## Consequences

Examples with no room render normally against a null source.
