# @jolly-pixel/engine

## 1.3.0

### Minor Changes

- [#153](https://github.com/JollyPixel/editor/pull/153) [`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735) Thanks [@fraxken](https://github.com/fraxken)! - Configure three as peerDependencies

- [#151](https://github.com/JollyPixel/editor/pull/151) [`64a510e`](https://github.com/JollyPixel/editor/commit/64a510e4e1fd094958c20d03c9386115e8fad6ca) Thanks [@fraxken](https://github.com/fraxken)! - Implement type-safe GameInstance.context

- [#148](https://github.com/JollyPixel/editor/pull/148) [`2bc5859`](https://github.com/JollyPixel/editor/commit/2bc5859c82e2118b1f49b1adaedba651a2490910) Thanks [@fraxken](https://github.com/fraxken)! - Export GlobalAudio class

- [#150](https://github.com/JollyPixel/editor/pull/150) [`b8b2b30`](https://github.com/JollyPixel/editor/commit/b8b2b305291248fcdd786ea70809e6f2c73a4778) Thanks [@fraxken](https://github.com/fraxken)! - Add the ability to get an Actor component by his typeName

### Patch Changes

- [#147](https://github.com/JollyPixel/editor/pull/147) [`3668c6e`](https://github.com/JollyPixel/editor/commit/3668c6e9b48655a1138371684e2798e40b3e14f5) Thanks [@fraxken](https://github.com/fraxken)! - Make GameInstance.createActor options optional

## 1.2.0

### Minor Changes

- [#138](https://github.com/JollyPixel/editor/pull/138) [`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c) Thanks [@fraxken](https://github.com/fraxken)! - Integrate new FixedTimeStep for gameloop with fixedUpdate and classical update

- [#140](https://github.com/JollyPixel/editor/pull/140) [`2404b11`](https://github.com/JollyPixel/editor/commit/2404b11df9e57c624d84c2bed0cee7c36f0656c3) Thanks [@fraxken](https://github.com/fraxken)! - Rename GameRenderer interface to Renderer

- [#141](https://github.com/JollyPixel/editor/pull/141) [`b080129`](https://github.com/JollyPixel/editor/commit/b080129f877bf61513dc555051d504683f986d76) Thanks [@fraxken](https://github.com/fraxken)! - Implement a createActor method on GameInstance

## 1.1.1

### Patch Changes

- [#134](https://github.com/JollyPixel/editor/pull/134) [`d6e45d6`](https://github.com/JollyPixel/editor/commit/d6e45d623e530a8b9fd6a5f6b617089c971e9caf) Thanks [@fraxken](https://github.com/fraxken)! - Fix deltaTime in FixedTimedStep (GameLoop)

- [#133](https://github.com/JollyPixel/editor/pull/133) [`688120c`](https://github.com/JollyPixel/editor/commit/688120c7beadada16f9b8622d2fc20c69e7be83a) Thanks [@fraxken](https://github.com/fraxken)! - Remove useless duplication and push of components in Actor.registerComponent + Add unique ID (index) to ActorComponent

- [#129](https://github.com/JollyPixel/editor/pull/129) [`b91acc0`](https://github.com/JollyPixel/editor/commit/b91acc0a3f0aa29fde0f1d8efa2221d20214072d) Thanks [@fraxken](https://github.com/fraxken)! - Properly destroy actor components in reverse order

## 1.1.0

### Minor Changes

- [#125](https://github.com/JollyPixel/editor/pull/125) [`acee776`](https://github.com/JollyPixel/editor/commit/acee776095c1a2437861b9bfe3d2b38ff119ba2f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal UI apis (UIRenderer, UINode, UISprite, UIText)
