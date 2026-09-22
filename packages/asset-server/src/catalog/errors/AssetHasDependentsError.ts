// CONSTANTS
const kNamedDependents = 3;

export interface DependentAsset {
  readonly id: string;
  readonly path: string;
}

export class AssetHasDependentsError extends Error {
  readonly assetId: string;
  readonly dependents: readonly DependentAsset[];

  constructor(
    assetId: string,
    dependents: readonly DependentAsset[]
  ) {
    super(`Asset "${assetId}" is still referenced by ${named(dependents)}.`);
    this.name = "AssetHasDependentsError";
    this.assetId = assetId;
    this.dependents = dependents.map((dependent) => {
      return {
        id: dependent.id,
        path: dependent.path
      };
    });
  }
}

function named(
  dependents: readonly DependentAsset[]
): string {
  const listed = dependents
    .slice(0, kNamedDependents)
    .map(({ path }) => `"${path}"`)
    .join(", ");
  const rest = dependents.length - kNamedDependents;

  return rest > 0 ? `${listed} and ${rest} more` : listed;
}
