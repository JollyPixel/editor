# @jolly-pixel/controls

## 2.0.0

### Major Changes

- [#514](https://github.com/JollyPixel/editor/pull/514) [`cd200eb`](https://github.com/JollyPixel/editor/commit/cd200ebf5440b27cecc74221104deae7e7bf9be6) Thanks [@fraxken](https://github.com/fraxken)! - Drop the `get`/`set` prefixes from device methods.

- [#515](https://github.com/JollyPixel/editor/pull/515) [`29c5ecb`](https://github.com/JollyPixel/editor/commit/29c5ecb28e364f5d9a96f787647c6dfd3d7b1454) Thanks [@fraxken](https://github.com/fraxken)! - Optimize the per-frame and query hot paths: idle devices skip `update()`, mouse position reads avoid forced layout, and queries no longer allocate.
