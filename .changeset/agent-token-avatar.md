---
"@jolly-pixel/accounts": minor
---

Agent tokens can carry an avatar: `AgentTokens.replaceAvatar` stores one and `AgentToken.avatar` points at it. `watchProfiles` now reports `{ avatar }` patches, for agents as for members.
