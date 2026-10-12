---
"@jolly-pixel/network": minor
---

`Client.reconnect()` reopens a client the server refused as `unauthorized`; joined rooms rejoin with their resume payload.
`ShellChannel.renewWhenRefused(client)` posts the `session-refused` shell command and reconnects on `sessionRenewedMessage()`; `EditorSession.open` wires it for framed editors.
