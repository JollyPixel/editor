// Import Third-party Dependencies
import type ThreeNode from "three/src/nodes/core/Node.js";
import type ThreeTextureNode from "three/src/nodes/accessors/TextureNode.js";

export type TslNode<TNodeType> = ThreeNode<TNodeType>;
export type TslTextureNode = ThreeTextureNode<"vec4">;
