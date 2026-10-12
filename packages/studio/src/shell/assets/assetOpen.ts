export interface AssetOpenDetail {
  assetId: string;
}

export function assetOpenEvent(
  assetId: string
): CustomEvent<AssetOpenDetail> {
  return new CustomEvent<AssetOpenDetail>("asset-open", {
    bubbles: true,
    composed: true,
    detail: { assetId }
  });
}

declare global {
  interface HTMLElementEventMap {
    "asset-open": CustomEvent<AssetOpenDetail>;
  }
}
