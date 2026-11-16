// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const ADMIN_ROLE = "admin";
export const GUEST_ROLE = "guest";
export const AVATAR_MAX_BYTES = 2 * 1_024 * 1_024;

export const accountSchema = z.object({
  id: z.string(),
  username: z.string(),
  owner: z.boolean(),
  avatar: z.string().optional()
});

export const memberSchema = accountSchema.extend({
  role: z.string()
});

export type Account = z.infer<typeof accountSchema>;

export type Member = z.infer<typeof memberSchema>;

export type AccessRequest = Pick<Account, "id" | "username">;
