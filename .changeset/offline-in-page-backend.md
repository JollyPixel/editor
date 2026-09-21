---
"@jolly-pixel/network": minor
"@jolly-pixel/asset-source": minor
"@jolly-pixel/asset-server": minor
---

The asset back-end can run inside a browser page: `LoopbackTransport` and `ClientOptions.socket` connect a `Client` to an in-process `Server`.
New Node-free entries `@jolly-pixel/asset-source/core` and `@jolly-pixel/asset-server/backend`.
Content hashes use WebCrypto: `writeData()` is async and `AssetWriter` applies writes one at a time, in call order.
