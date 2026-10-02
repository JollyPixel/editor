// Import Internal Dependencies
import type {
  AssetKindDescriptor,
  AssetKindPackage
} from "#src/index.ts";
import type { PackageLoader } from "#src/node.ts";
import { counterHandler } from "./kinds.ts";

export function kindDescriptor(
  kind: string
): AssetKindDescriptor {
  return {
    kind,
    label: kind,
    extension: `.${kind}`
  };
}

export function kindPackage(
  kinds: readonly string[],
  received: object[] = []
): AssetKindPackage {
  return {
    descriptors: kinds.map(kindDescriptor),
    optionsSchema: {
      type: "object"
    },
    handlers(options = {}) {
      received.push(options);

      return kinds.map((kind) => {
        return {
          ...counterHandler(),
          kind,
          extensions: {
            [`.${kind}`]: "text/plain"
          }
        };
      });
    }
  };
}

export function packageLoader(
  packages: Record<string, unknown>
): PackageLoader {
  return async(packageName) => {
    if (!(packageName in packages)) {
      throw new Error(`Cannot find "${packageName}".`);
    }

    return packages[packageName];
  };
}
