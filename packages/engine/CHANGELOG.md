# @jolly-pixel/engine

## 2.1.0

### Minor Changes

- [#168](https://github.com/JollyPixel/editor/pull/168) [`dd4d9c6`](https://github.com/JollyPixel/editor/commit/dd4d9c6d51048e2debd5c6fbe279dbfc5dd2cb86) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement part of the game loop into World and expose hooks as EE

- [#162](https://github.com/JollyPixel/editor/pull/162) [`2a3261b`](https://github.com/JollyPixel/editor/commit/2a3261b5d7516a3e7e2cfe8612c8e214f4b029ac) Thanks [@fraxken](https://github.com/fraxken)! - Implement fixedUpdate lifecycle and enhance component with needUpdate

- [#169](https://github.com/JollyPixel/editor/pull/169) [`519f4f1`](https://github.com/JollyPixel/editor/commit/519f4f1c4b03373fce674b009ac48dc9a4ff4692) Thanks [@fraxken](https://github.com/fraxken)! - Optimize SceneManager, Actor and ActorTree

### Patch Changes

- [#166](https://github.com/JollyPixel/editor/pull/166) [`70f1b3b`](https://github.com/JollyPixel/editor/commit/70f1b3beefec61d38a8c0d1b617dd549540f406d) Thanks [@fraxken](https://github.com/fraxken)! - Use ResizeObserver to properly resize the screen and renderComponents aspect

## 2.0.0

### Major Changes

- [#157](https://github.com/JollyPixel/editor/pull/157) [`c3ca721`](https://github.com/JollyPixel/editor/commit/c3ca72107b76c40e6cb81785883c82b01ffc0a02) Thanks [@fraxken](https://github.com/fraxken)! - Major refactoring of ECS APIs (GameInstance -> World, Actor and ActorComponent breaking, SceneEngine -> SceneManager, new Transform APIs, etc)

### Patch Changes

- [#155](https://github.com/JollyPixel/editor/pull/155) [`c8405ca`](https://github.com/JollyPixel/editor/commit/c8405caba754802a9fdd5851411fa5af492c4e4b) Thanks [@fraxken](https://github.com/fraxken)! - Fix some mistake with newest GameInstance TContext generic and add a type GameInstanceDefaultContext to avoid repeting the default type everywhere

## 1.3.0

### Minor Changes

- [#153](https://github.com/JollyPixel/editor/pull/153) [`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735) Thanks [@fraxken](https://github.com/fraxken)! - Configure three as peerDependencies

- [#151](https://github.com/JollyPixel/editor/pull/151) [`64a510e`](https://github.com/JollyPixel/editor/commit/64a510e4e1fd094958c20d03c9386115e8fad6ca) Thanks [@fraxken](https://github.com/fraxken)! - Implement type-safe World.context

- [#148](https://github.com/JollyPixel/editor/pull/148) [`2bc5859`](https://github.com/JollyPixel/editor/commit/2bc5859c82e2118b1f49b1adaedba651a2490910) Thanks [@fraxken](https://github.com/fraxken)! - Export GlobalAudio class

- [#150](https://github.com/JollyPixel/editor/pull/150) [`b8b2b30`](https://github.com/JollyPixel/editor/commit/b8b2b305291248fcdd786ea70809e6f2c73a4778) Thanks [@fraxken](https://github.com/fraxken)! - Add the ability to get an Actor component by his typeName

### Patch Changes

- [#147](https://github.com/JollyPixel/editor/pull/147) [`3668c6e`](https://github.com/JollyPixel/editor/commit/3668c6e9b48655a1138371684e2798e40b3e14f5) Thanks [@fraxken](https://github.com/fraxken)! - Make World.createActor options optional

## 1.2.0

### Minor Changes

- [#138](https://github.com/JollyPixel/editor/pull/138) [`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c) Thanks [@fraxken](https://github.com/fraxken)! - Integrate new FixedTimeStep for gameloop with fixedUpdate and classical update

- [#140](https://github.com/JollyPixel/editor/pull/140) [`2404b11`](https://github.com/JollyPixel/editor/commit/2404b11df9e57c624d84c2bed0cee7c36f0656c3) Thanks [@fraxken](https://github.com/fraxken)! - Rename GameRenderer interface to Renderer

- [#141](https://github.com/JollyPixel/editor/pull/141) [`b080129`](https://github.com/JollyPixel/editor/commit/b080129f877bf61513dc555051d504683f986d76) Thanks [@fraxken](https://github.com/fraxken)! - Implement a createActor method on World

## 1.1.1

### Patch Changes

- [#134](https://github.com/JollyPixel/editor/pull/134) [`d6e45d6`](https://github.com/JollyPixel/editor/commit/d6e45d623e530a8b9fd6a5f6b617089c971e9caf) Thanks [@fraxken](https://github.com/fraxken)! - Fix deltaTime in FixedTimedStep (GameLoop)

- [#133](https://github.com/JollyPixel/editor/pull/133) [`688120c`](https://github.com/JollyPixel/editor/commit/688120c7beadada16f9b8622d2fc20c69e7be83a) Thanks [@fraxken](https://github.com/fraxken)! - Remove useless duplication and push of components in Actor.addComponent + Add unique ID (index) to ActorComponent

- [#129](https://github.com/JollyPixel/editor/pull/129) [`b91acc0`](https://github.com/JollyPixel/editor/commit/b91acc0a3f0aa29fde0f1d8efa2221d20214072d) Thanks [@fraxken](https://github.com/fraxken)! - Properly destroy actor components in reverse order

## 1.1.0

### Minor Changes

- [#125](https://github.com/JollyPixel/editor/pull/125) [`acee776`](https://github.com/JollyPixel/editor/commit/acee776095c1a2437861b9bfe3d2b38ff119ba2f) Thanks [@fraxken](https://github.com/fraxken)! - Implement minimal UI apis (UIRenderer, UINode, UISprite, UIText)
