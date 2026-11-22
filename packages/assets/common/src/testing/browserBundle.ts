// Import Third-party Dependencies
import * as esbuild from "esbuild";

// CONSTANTS
export const KIND_HANDLER_INPUT =
  /[/\\]asset-server[/\\]dist[/\\]model[/\\]kinds[/\\](?:authoring|errors)[/\\]|AssetKind\.ts$/;

export async function browserBundleInputs(
  entryPoint: string,
  ...patterns: RegExp[]
): Promise<string[]> {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    metafile: true,
    logLevel: "silent"
  });
  const [output] = Object.values(result.metafile.outputs);

  return Object.entries(output.inputs)
    .filter(([inputPath, { bytesInOutput }]) => (
      bytesInOutput > 0 && patterns.some((pattern) => pattern.test(inputPath))
    ))
    .map(([inputPath]) => inputPath);
}
