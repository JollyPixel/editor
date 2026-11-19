// Import Third-party Dependencies
import ts from "typescript";

// CONSTANTS
export const LIB_DIRECTORY = "/lib";
export const NODE_MODULES_DIRECTORY = "/node_modules";

export const SCRIPT_COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ["lib.es2023.d.ts", "lib.dom.d.ts"],
  types: [],
  strict: true,
  allowJs: true,
  allowImportingTsExtensions: true,
  skipLibCheck: true,
  noEmit: true
};
