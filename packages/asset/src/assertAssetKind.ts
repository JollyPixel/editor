export function assertAssetKind(
  kind: string
): void {
  if (
    kind.trim().length === 0 ||
    kind.includes(":")
  ) {
    throw new TypeError("Asset kind must be non-empty without a colon.");
  }
}
