---
"@jolly-pixel/accounts": minor
"@jolly-pixel/network": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/ui": minor
---

Add view-only share links: `accounts.shareLinks` stores expiring link tokens that `authenticate` resolves to a `GUEST_ROLE` identity, and the `Server` option `admits` limits that identity to some rooms.
`CatalogViewExtension` serves a read-only catalog scoped to one asset's dependency closure (`CatalogClient.connect(client, { room })`), `launchElement` injects the launch, and `createAssetWorkspacePlugin({ http: false })` drops the unauthenticated HTTP routes.
`PresencePeer.badge` shows "via link" for guests.
