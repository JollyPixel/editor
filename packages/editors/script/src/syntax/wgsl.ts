// Import Third-party Dependencies
import type { ParseOptions } from "sugar-high/core";
import {
  onCommentEnd,
  onCommentStart
} from "sugar-high/lang/glsl";

// CONSTANTS
const kScalars = ["bool", "f16", "f32", "i32", "u32"];
const kSizes = [2, 3, 4];
const kVectors = kSizes.flatMap((size) => ["", "f", "h", "i", "u"]
  .map((suffix) => `vec${size}${suffix}`));
const kMatrices = kSizes.flatMap((columns) => kSizes
  .flatMap((rows) => ["", "f", "h"]
    .map((suffix) => `mat${columns}x${rows}${suffix}`)));
const kTextures = [
  "1d",
  "2d",
  "2d_array",
  "3d",
  "cube",
  "cube_array",
  "multisampled_2d",
  "depth_2d",
  "depth_2d_array",
  "depth_cube",
  "depth_cube_array",
  "depth_multisampled_2d",
  "storage_1d",
  "storage_2d",
  "storage_2d_array",
  "storage_3d",
  "external"
].map((name) => `texture_${name}`);

export const WGSL_SYNTAX: ParseOptions = {
  onCommentStart,
  onCommentEnd,
  jsx: false,
  regex: false,
  templateStrings: false,
  keywords: new Set([
    "alias",
    "break",
    "case",
    "const",
    "const_assert",
    "continue",
    "continuing",
    "default",
    "diagnostic",
    "discard",
    "else",
    "enable",
    "false",
    "fn",
    "for",
    "if",
    "let",
    "loop",
    "override",
    "requires",
    "return",
    "struct",
    "switch",
    "true",
    "var",
    "while",
    "function",
    "private",
    "workgroup",
    "uniform",
    "storage",
    "read",
    "write",
    "read_write",
    "vertex",
    "fragment",
    "compute",
    "builtin",
    "location",
    "group",
    "binding",
    "interpolate",
    "workgroup_size"
  ]),
  typeKeywords: new Set([
    ...kScalars,
    ...kVectors,
    ...kMatrices,
    ...kTextures,
    "array",
    "atomic",
    "ptr",
    "sampler",
    "sampler_comparison"
  ])
};
