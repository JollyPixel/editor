// Import Third-party Dependencies
import * as z from "zod";

// CONSTANTS
export const ADMIN_ROLE = "admin";
export const ACCOUNTS_URL_PATH = "/api/accounts/";

export const accountSchema = z.object({
  id: z.string(),
  username: z.string(),
  role: z.string()
});

export type Account = z.infer<typeof accountSchema>;
