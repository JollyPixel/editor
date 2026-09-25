// CONSTANTS
export const DEFAULT_ARCHIVE_MAX_ENTRY_BYTES = 16 * 1024 * 1024;
export const DEFAULT_ARCHIVE_MAX_BYTES = 64 * 1024 * 1024;

/**
 * Decoded size caps of an archive read, in bytes.
 */
export interface ArchiveLimits {
  /**
   * @default DEFAULT_ARCHIVE_MAX_ENTRY_BYTES
   */
  maxEntryBytes?: number;
  /**
   * @default DEFAULT_ARCHIVE_MAX_BYTES
   */
  maxBytes?: number;
}
