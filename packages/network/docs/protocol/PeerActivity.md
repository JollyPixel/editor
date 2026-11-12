# Peer activity

An activity is a short label a peer publishes in its presence under
`PEER_ACTIVITY_KEY` (`"activity"`) to say what it is doing, such as
"Placing 12 trees". Collaborator lists show it next to the peer's name.

```ts
import {
  PEER_ACTIVITY_KEY,
  parsePeerActivity,
  peerActivitySchema
} from "@jolly-pixel/network/client";

room.updatePresence({
  [PEER_ACTIVITY_KEY]: peerActivitySchema.parse({
    label: "Placing 12 trees",
    progress: 0.25
  })
});
room.updatePresence({ [PEER_ACTIVITY_KEY]: null });

const activity = parsePeerActivity(room.peers.get(clientId)?.presence);
```

## `peerActivitySchema`

The shape to publish: `label`, 1 to `PEER_ACTIVITY_LABEL_MAX_LENGTH` (200)
characters, and an optional `progress` from 0 to 1. Other fields are refused.
Publishing `null` clears the activity.

## `parsePeerActivity(presence)`

Reads a peer's presence into a `PeerActivity`, or `null` when the value is
missing, cleared or malformed. It never throws.
