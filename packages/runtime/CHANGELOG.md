# @jolly-pixel/runtime

## 3.3.0

### Minor Changes

- [#236](https://github.com/JollyPixel/editor/pull/236) [`dfff053`](https://github.com/JollyPixel/editor/commit/dfff05301b97c739b264b74515bb25f4ff3fbf38) Thanks [@fraxken](https://github.com/fraxken)! - Add a focusCanvas to disable permanent canvas focus listener

## 3.2.0

### Minor Changes

- [#175](https://github.com/JollyPixel/editor/pull/175) [`f50efc5`](https://github.com/JollyPixel/editor/commit/f50efc5a4962203a136f9bc5e604f9535ef0c11e) Thanks [@fraxken](https://github.com/fraxken)! - Enhance and fix bugs with Asset Management

### Patch Changes

- Updated dependencies [[`f50efc5`](https://github.com/JollyPixel/editor/commit/f50efc5a4962203a136f9bc5e604f9535ef0c11e), [`f48549e`](https://github.com/JollyPixel/editor/commit/f48549e90658b774a6913bbf8630c358630121ed)]:
  - @jolly-pixel/engine@2.2.0

## 3.1.0

### Minor Changes

- [#168](https://github.com/JollyPixel/editor/pull/168) [`dd4d9c6`](https://github.com/JollyPixel/editor/commit/dd4d9c6d51048e2debd5c6fbe279dbfc5dd2cb86) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement part of the game loop into World and expose hooks as EE

- [#162](https://github.com/JollyPixel/editor/pull/162) [`2a3261b`](https://github.com/JollyPixel/editor/commit/2a3261b5d7516a3e7e2cfe8612c8e214f4b029ac) Thanks [@fraxken](https://github.com/fraxken)! - Implement fixedUpdate lifecycle and enhance component with needUpdate

### Patch Changes

- [#159](https://github.com/JollyPixel/editor/pull/159) [`fb3e1b5`](https://github.com/JollyPixel/editor/commit/fb3e1b50ef7e7976c3411593ac3ba58168eb1f29) Thanks [@fraxken](https://github.com/fraxken)! - Fix loadRuntime so error throw in world.connect() can escalate the stack

- Updated dependencies [[`70f1b3b`](https://github.com/JollyPixel/editor/commit/70f1b3beefec61d38a8c0d1b617dd549540f406d), [`dd4d9c6`](https://github.com/JollyPixel/editor/commit/dd4d9c6d51048e2debd5c6fbe279dbfc5dd2cb86), [`2a3261b`](https://github.com/JollyPixel/editor/commit/2a3261b5d7516a3e7e2cfe8612c8e214f4b029ac), [`519f4f1`](https://github.com/JollyPixel/editor/commit/519f4f1c4b03373fce674b009ac48dc9a4ff4692)]:
  - @jolly-pixel/engine@2.1.0

## 3.0.0

### Major Changes

- [#157](https://github.com/JollyPixel/editor/pull/157) [`c3ca721`](https://github.com/JollyPixel/editor/commit/c3ca72107b76c40e6cb81785883c82b01ffc0a02) Thanks [@fraxken](https://github.com/fraxken)! - Major refactoring of ECS APIs (GameInstance -> World, Actor and ActorComponent breaking, SceneEngine -> SceneManager, new Transform APIs, etc)

### Patch Changes

- [#155](https://github.com/JollyPixel/editor/pull/155) [`c8405ca`](https://github.com/JollyPixel/editor/commit/c8405caba754802a9fdd5851411fa5af492c4e4b) Thanks [@fraxken](https://github.com/fraxken)! - Fix some mistake with newest GameInstance TContext generic and add a type GameInstanceDefaultContext to avoid repeting the default type everywhere

- Updated dependencies [[`c8405ca`](https://github.com/JollyPixel/editor/commit/c8405caba754802a9fdd5851411fa5af492c4e4b), [`c3ca721`](https://github.com/JollyPixel/editor/commit/c3ca72107b76c40e6cb81785883c82b01ffc0a02)]:
  - @jolly-pixel/engine@2.0.0

## 2.0.0

### Major Changes

- [#152](https://github.com/JollyPixel/editor/pull/152) [`ca274cf`](https://github.com/JollyPixel/editor/commit/ca274cf06e148676cfb30a129f19decfb1eed910) Thanks [@fraxken](https://github.com/fraxken)! - Rename Player to Runtime and introduce World context

### Minor Changes

- [#153](https://github.com/JollyPixel/editor/pull/153) [`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735) Thanks [@fraxken](https://github.com/fraxken)! - Configure three as peerDependencies

### Patch Changes

- Updated dependencies [[`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735), [`64a510e`](https://github.com/JollyPixel/editor/commit/64a510e4e1fd094958c20d03c9386115e8fad6ca), [`2bc5859`](https://github.com/JollyPixel/editor/commit/2bc5859c82e2118b1f49b1adaedba651a2490910), [`b8b2b30`](https://github.com/JollyPixel/editor/commit/b8b2b305291248fcdd786ea70809e6f2c73a4778), [`3668c6e`](https://github.com/JollyPixel/editor/commit/3668c6e9b48655a1138371684e2798e40b3e14f5)]:
  - @jolly-pixel/engine@1.3.0

## 1.1.0

### Minor Changes

- [#138](https://github.com/JollyPixel/editor/pull/138) [`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c) Thanks [@fraxken](https://github.com/fraxken)! - Integrate new FixedTimeStep for gameloop with fixedUpdate and classical update

### Patch Changes

- Updated dependencies [[`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c), [`2404b11`](https://github.com/JollyPixel/editor/commit/2404b11df9e57c624d84c2bed0cee7c36f0656c3), [`b080129`](https://github.com/JollyPixel/editor/commit/b080129f877bf61513dc555051d504683f986d76)]:
  - @jolly-pixel/engine@1.2.0
