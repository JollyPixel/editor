---
"@jolly-pixel/network": minor
"@jolly-pixel/accounts": minor
"@jolly-pixel/ui": patch
---

Profiles update live: `Server.updateProfile` (fed by `AuthenticationProvider.watchProfiles`) sends `peer-profile` to every room member, and `Room.profile` holds the profile the server admitted for this client.
`Accounts.watchProfiles` reports a new avatar, and `PeerRoster` follows both, so peers and the local row show it without reconnecting.
