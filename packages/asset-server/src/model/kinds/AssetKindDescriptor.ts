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

export interface AssetKindDescriptor {
  kind: string;
  label: string;
  extension: string;
  icon?: AssetKindIcon;
  /**
   * `false` when assets of the kind only come from an import, never from an
   * empty file.
   * @default true
   */
  creatable?: boolean;
}

export interface LoadedAssetKind extends AssetKindDescriptor {
  /**
   * Extensions the kind's handler converts from, the keys of its
   * `conversions`.
   */
  convertsFrom: readonly string[];
}
