// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import type { PackageResolver } from "@jolly-pixel/asset-server/node";
import * as z from "zod";

// Import Internal Dependencies
import type {
  KindPackageDescriptor,
  SceneComponentDeclaration
} from "../ProjectManifest.ts";

// CONSTANTS
const kManifestFile = "package.json";
const kManifestSchema = z.object({
  jollypixel: z.object({
    sceneComponents: z.record(
      z.string().min(1),
      z.object({
        assets: z.record(z.string().min(1), z.string().min(1)).default({})
      })
    ).optional()
  }).optional()
});

export function readKindSceneComponents(
  packageName: string,
  resolver: PackageResolver
): SceneComponentDeclaration[] {
  const manifest = kManifestSchema.safeParse(
    JSON.parse(fs.readFileSync(
      path.join(resolver.locate(packageName), kManifestFile),
      "utf8"
    ))
  );
  if (!manifest.success) {
    const reason = z.prettifyError(manifest.error);

    throw new TypeError(
      `"${packageName}" declares invalid "jollypixel.sceneComponents":\n${reason}`
    );
  }

  return Object.entries(manifest.data.jollypixel?.sceneComponents ?? {}).map(
    ([type, { assets }]) => {
      return {
        type,
        assets
      };
    }
  );
}

export function assertOneOwnerPerComponent(
  kindPackages: Iterable<KindPackageDescriptor>
): void {
  const owners = new Map<string, string>();
  for (const { name, sceneComponents } of kindPackages) {
    for (const { type } of sceneComponents) {
      const owner = owners.get(type);
      if (owner !== undefined) {
        throw new TypeError(
          `Scene component "${type}" is declared by both "${owner}" and "${name}".`
        );
      }
      owners.set(type, name);
    }
  }
}
