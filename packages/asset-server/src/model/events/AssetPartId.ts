// CONSTANTS
export const ASSET_PART_ID_MAX_LENGTH = 128;
export const ASSET_PART_ID_PATTERN = new RegExp(
  `^(?!__proto__$)[A-Za-z0-9_-]{1,${ASSET_PART_ID_MAX_LENGTH}}$`
);
