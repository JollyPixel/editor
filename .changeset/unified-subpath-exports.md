---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/asset-source": major
"@jolly-pixel/image": major
"@jolly-pixel/voxel.renderer": major
"@jolly-pixel/event-store": major
"@jolly-pixel/three": patch
"@jolly-pixel/arbor": patch
"@jolly-pixel/asset": patch
"@jolly-pixel/color": patch
"@jolly-pixel/controls": patch
"@jolly-pixel/engine": patch
"@jolly-pixel/loop": patch
"@jolly-pixel/resize-handle": patch
"@jolly-pixel/runtime": patch
---
Subpaths follow one naming scheme: `network/node` (now with the Vite plugin), `asset-server/{client,node}`, `asset-source/node`, `event-store/node` (was `./sqlite`), `image/browser` and `voxel.renderer/engine` (the Rapier plugin joins the root). `.ts` keys, wildcards, `network/parser` and `network/transport/*` are removed; transports ship from the network root, `./client` and `./node`.
The `asset-server` and `asset-source` roots are now browser-safe and absorb `./backend`, `./kinds`, `./core` and `./indexeddb`; Node-only code moves to `./node`.
Every published package declares `exports` instead of `main`/`types`, and the packages with no import-time side effects declare `"sideEffects": false`.
