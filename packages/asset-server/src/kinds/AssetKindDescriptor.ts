export interface AssetKindIcon {
  /**
   * SVG children drawn in `viewBox`, without the `<svg>` element.
   */
  svg: string;
  tone?: string;
  /**
   * @default "0 0 24 24"
   */
  viewBox?: string;
}

/**
 * Serializable presentation data for an asset kind, read by hosts that list
 * or open assets without loading the kind's handler.
 */
export interface AssetKindDescriptor {
  kind: string;
  label: string;
  extension: string;
  icon?: AssetKindIcon;
}
