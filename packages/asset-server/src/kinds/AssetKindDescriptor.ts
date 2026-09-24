export interface AssetKindIcon {
  /**
   * SVG children drawn in a 24x24 view box, without the `<svg>` element.
   */
  svg: string;
  tone?: string;
}

/**
 * Serializable presentation data for an asset kind, read by hosts that list
 * or open assets without loading the kind's handler.
 */
export interface AssetKindDescriptor {
  kind: string;
  label: string;
  icon?: AssetKindIcon;
}
