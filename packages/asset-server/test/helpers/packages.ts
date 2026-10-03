// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

export function kindModule(
  kind: string
): string {
  return "export const ASSET_KINDS = {\n" +
    "  descriptors: [],\n" +
    "  optionsSchema: { type: \"object\" },\n" +
    `  handlers: (options) => [{ kind: ${JSON.stringify(kind)}, options }]\n` +
    "};\n";
}

export async function writePackage(
  directory: string,
  manifest: Record<string, unknown>,
  files: Record<string, string> = {}
): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      type: "module",
      ...manifest
    })
  );
  for (const [file, content] of Object.entries(files)) {
    await fs.writeFile(path.join(directory, file), content);
  }

  return directory;
}

export function writeKindPackage(
  directory: string,
  name: string,
  kind = "alpha"
): Promise<string> {
  return writePackage(
    directory,
    {
      name,
      exports: "./index.js"
    },
    {
      "index.js": kindModule(kind)
    }
  );
}
