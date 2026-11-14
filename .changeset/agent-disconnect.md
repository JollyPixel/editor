---
"@jolly-pixel/network": minor
"@jolly-pixel/accounts": minor
---

Add `server.disconnect(subject)` and the provider's optional `watchDisconnections(listener)`, which close a subject's connections as refused with the reason `"disconnected"`; `unauthorized` now passes the close reason.
`agentTokens.disconnect(ownerId, tokenId)` uses it to drop an agent and keep its token; `parseAgentProfile(metadata)` reads an agent's profile, which now carries its `ownerId`.
