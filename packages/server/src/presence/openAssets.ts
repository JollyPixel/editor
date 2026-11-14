// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
const kMaxOpenAssets = 64;

export const OPEN_ASSETS_KEY = "openAssets";

export const openAssetsSchema = z.strictObject({
  open: z.array(z.string().min(1)).max(kMaxOpenAssets),
  focused: z.string().min(1).nullable()
});

export type OpenAssets = z.infer<typeof openAssetsSchema>;

export function openAssets(
  assetIds: Iterable<string>,
  focused: string | null
): OpenAssets {
  return {
    open: [...assetIds].slice(0, kMaxOpenAssets),
    focused
  };
}
