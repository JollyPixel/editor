// Import Internal Dependencies
import { compileScript } from "#compiler";
import { stripTypes } from "#stripper";
import {
  SCRIPT_IMPORTS,
  SHADER_IMPORTS
} from "../imports/importPolicies.ts";

// CONSTANTS
const kShaderFileName = "shader.tsl.ts";

export async function buildScript(
  source: string
): Promise<string> {
  const code = await compileScript(source);
  await SCRIPT_IMPORTS.check(code);

  return code;
}

export async function buildShader(
  source: string
): Promise<string> {
  const code = await stripTypes(source, kShaderFileName);
  await SHADER_IMPORTS.check(code);

  return code;
}
