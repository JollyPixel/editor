// Import Internal Dependencies
import { buildShader } from "../compiler/build.ts";
import { SourceError } from "../compiler/errors/SourceError.ts";
import { ShaderModule } from "./ShaderModule.ts";

export async function loadShader(
  source: string,
  name: string
): Promise<ShaderModule> {
  const code = await buildShader(source).catch((cause: unknown) => {
    throw SourceError.thrown(cause, null);
  });

  return ShaderModule.load(code, name);
}
