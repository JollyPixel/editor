// Import Internal Dependencies
import {
  ModelAssetLoader,
  ModelAssetType
} from "./model.ts";
import {
  FontAssetLoader,
  FontAssetType
} from "./font.ts";

export * from "./audio.ts";
export * from "./sceneFile.ts";
export * from "./texture.ts";
export * from "./createDefaultAssetLoaders.ts";
export {
  ModelAssetLoader,
  ModelAssetType,
  modelTextureNames,
  parseModel,
  type Model,
  type ModelParseOptions
} from "./model.ts";
export {
  FontAssetLoader,
  FontAssetType,
  type Font
} from "./font.ts";
export {
  ShaderAssetType,
  describeShaderUniform,
  isShaderUniformValue,
  shaderTextureSlot,
  type ShadedMaterial,
  type Shader,
  type ShaderUniformDescription,
  type ShaderUniformValue,
  type ShaderUniformValues
} from "./shader.ts";

export const AssetLoaders = {
  model: ModelAssetLoader,
  font: FontAssetLoader
} as const;

export const AssetTypes = {
  model: ModelAssetType,
  font: FontAssetType
} as const;
