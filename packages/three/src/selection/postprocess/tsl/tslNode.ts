// Import Third-party Dependencies
import type ThreeNode from "three/src/nodes/core/Node.js";

/**
 * The actual common interface every TSL node (`uniform()`, `float()`,
 * `vec2()`, `instancedBufferAttribute()`, ...) shares once built - the
 * type `.mul()`/`.div()`/`.lessThan()` and friends are declared against.
 * Neither `three/tsl` nor `three/webgpu` re-exports it (their `.d.ts`
 * files only re-export TSL functions as `const` values, never the
 * `Node<T>` type they return), so this reaches into three's own internal
 * source path for the type only - no runtime import. If a future three
 * upgrade moves or renames this file, this is the only place that needs
 * to change.
 */
export type TslNode<TNodeType> = ThreeNode<TNodeType>;
