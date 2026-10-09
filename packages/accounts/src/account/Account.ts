// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const ADMIN_ROLE = "admin";
export const AVATAR_MAX_BYTES = 2 * 1_024 * 1_024;

export const accountSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string(),
  owner: z.boolean(),
  avatar: z.string().optional()
});

export type Account = z.infer<typeof accountSchema>;

export type AccessRequest = Pick<Account, "id" | "username">;
