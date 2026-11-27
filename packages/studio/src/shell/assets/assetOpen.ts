export interface AssetOpenDetail {
  assetId: string;
  tag?: string;
}

export function assetOpenEvent(
  assetId: string,
  tag?: string
): CustomEvent<AssetOpenDetail> {
  return new CustomEvent<AssetOpenDetail>("asset-open", {
    bubbles: true,
    composed: true,
    detail: tag === undefined ? { assetId } : { assetId, tag }
  });
}

declare global {
  interface HTMLElementEventMap {
    "asset-open": CustomEvent<AssetOpenDetail>;
  }
}
