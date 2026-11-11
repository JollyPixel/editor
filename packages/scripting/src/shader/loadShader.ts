// Import Internal Dependencies
import { stripTypes } from "#stripper";
import { ShaderModule } from "./ShaderModule.ts";

export async function loadShader(
  source: string,
  name: string
): Promise<ShaderModule> {
  return ShaderModule.load(await stripTypes(source, name), name);
}
